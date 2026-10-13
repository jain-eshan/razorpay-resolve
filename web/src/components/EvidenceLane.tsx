import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useBreakpoint } from '@razorpay/blade/utils'
import {
  ActivityIcon, BellIcon, Box, EyeIcon, GlobeIcon, RazorpayIcon, ServerIcon, ShoppingCartIcon, SmartphoneIcon, Text, UserIcon, useTheme, type IconComponent,
} from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { when } from '../lib/format'
import { clock } from '../lib/time'
import { useWidth } from '../lib/useWidth'
import { Panel } from './Panel'
import { Pulse } from './Pulse'

export type Tone = 'negative' | 'positive' | 'notice' | 'information' | 'neutral'
export type Item = { at: string; to?: string; open?: boolean; label: string; tone: Tone }  // a moment, or a stretch of time when `to` is given; `open`: it has no end yet, so it runs to the edge of the axis
export type Row = { name: string; items: Item[] }
type Inc = Pick<Schemas['IncidentDetail'], 'mismatch_type' | 'onset_at' | 'would_have_alerted_at'> & { verdict: Pick<Schemas['IncidentDetail']['verdict'], 'onset_at' | 'resolved_at' | 'signature'> }
type Bg = 'surface.background.gray.moderate' | 'surface.background.gray.intense'
// A stretch is a soft fill in its outcome's colour, with no outline; a moment is a solid dot in the same colour. Colour says the outcome only, so the row icons stay grey.
const BAR: Record<Tone, string> = { negative: 'feedback.background.negative.subtle', positive: 'feedback.background.positive.subtle', notice: 'feedback.background.notice.subtle', information: 'feedback.background.information.subtle', neutral: 'feedback.background.neutral.subtle' }
const DOT: Record<Tone, string> = { negative: 'feedback.background.negative.intense', positive: 'feedback.background.positive.intense', notice: 'feedback.background.notice.intense', information: 'feedback.background.information.intense', neutral: 'feedback.background.neutral.intense' }
const LIVE = { negative: 'negative', notice: 'notice', positive: 'positive', information: 'information', neutral: 'notice' } as const

// Whose row it is, as a small grey icon before its name, so a row is recognised before it is read: you (a change on your side), your server, your app or checkout, your pay page,
// Razorpay, an alert tool (Sentry and the like), Resolve. Matched on the row's name, because the brand account's rows come from its own data.
const ICONS: [RegExp, IconComponent][] = [[/razorpay/i, RazorpayIcon], [/resolve/i, EyeIcon], [/server/i, ServerIcon], [/checkout/i, ShoppingCartIcon], [/pay page/i, GlobeIcon],
  [/\bapp\b/i, SmartphoneIcon], [/your side/i, UserIcon], [/sentry|datadog|pagerduty|alert/i, BellIcon]]
const iconFor = (name: string) => ICONS.find(([re]) => re.test(name))?.[1] ?? ActivityIcon

// Ticks at round times on the issue's own axis (every 15 minutes up to every three days, in India's time), so the axis reads "12:00, 00:00, 12:00" and not "12:31, 04:48".
// Null when no round step gives three to `max` ticks; the axis then falls back to equal steps from edge to edge.
const IST = 19_800_000
const STEPS = [15, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880, 4320].map((m) => m * 60_000)
function roundTicks(a: number, b: number, max: number) {
  for (const s of STEPS) {
    const ts: number[] = []
    // Counted from a midnight: the first day's for steps inside a day, the first one on the axis for steps of days, so a two-day step starts at the first date shown.
    const day0 = Math.floor((a + IST) / 86_400_000) * 86_400_000 - IST, midnight = s >= 86_400_000 && day0 < a ? day0 + 86_400_000 : day0
    for (let t = midnight + Math.ceil((a - midnight) / s) * s; t <= b; t += s) ts.push(t)
    if (ts.length <= max) return ts.length >= 3 ? { ts, step: s } : null
  }
  return null
}
const day = (iso: string) => when(iso).split(',')[0]  // "Tue 29 Sep"

// The rows of the lane for each kind of issue, from what the engine saved: when your change went live, when the failures ran, what Razorpay recorded in the same hours,
// and when Resolve would have alerted. A row is left out when it would say nothing true (Razorpay's payments were not fine in a gateway issue; nothing changed on
// your side in one that is Razorpay's).
function rowsFor(inc: Inc, pack?: Schemas['EvidencePack']): Row[] {
  const v = inc.verdict, sig = v.signature as Record<string, unknown>
  const str = (k: string) => (typeof sig[k] === 'string' ? (sig[k] as string) : undefined)
  const end = v.resolved_at ?? pack?.last_failure_at ?? undefined
  const change = pack?.linked_change?.split(':')[0]
  const alert = inc.would_have_alerted_at ? [{ at: inc.would_have_alerted_at, label: 'Resolve would have alerted', tone: 'information' as const }] : []
  const rows: Row[] = []
  switch (inc.mismatch_type) {
    case 'A':
      rows.push({ name: 'Your side', items: [{ at: v.onset_at, label: `${change ?? 'Change'} live`, tone: 'neutral' }, ...(v.resolved_at ? [{ at: v.resolved_at, label: 'Server answered again', tone: 'positive' as const }] : [])] })
      if (pack?.first_failure_at) rows.push({ name: 'Your server', items: [{ at: pack.first_failure_at, to: end, label: `answered ${sig.status ?? 'with an error'}`, tone: 'negative' }] })
      rows.push({ name: 'Razorpay', items: [{ at: v.onset_at, to: end ?? pack?.first_failure_at ?? undefined, label: 'payments captured normally', tone: 'positive' }] })
      break
    case 'E': {
      const release = str('release_at'), first = str('first_at'), last = str('last_at')
      rows.push({ name: 'Your side', items: [{ at: release ?? v.onset_at, label: `${str('app_version') ?? 'App'} released`, tone: 'neutral' }] })
      if (first) rows.push({ name: 'Your app', items: [{ at: first, to: last, label: 'second order after a double tap', tone: 'negative' }] })
      rows.push({ name: 'Razorpay', items: [{ at: first ?? v.onset_at, to: last, label: 'both charges captured', tone: 'positive' }] })
      break
    }
    case 'G':
      rows.push({ name: 'Razorpay', items: [{ at: pack?.first_failure_at ?? v.onset_at, to: pack?.last_failure_at ?? undefined, label: 'gateway errors on cards', tone: 'negative' }] })
      break
    default:  // the pay page, before any payment
      rows.push({ name: 'Your side', items: [{ at: v.onset_at, label: 'Change went live', tone: 'neutral' }] })  // the change itself is in the root cause card; a long one would not fit here
      rows.push({ name: 'Your pay page', items: [{ at: v.onset_at, to: str('end') ?? undefined, open: !str('end'), label: str('end') ? 'failing' : 'failing, still open', tone: 'negative' }] })
  }
  if (alert.length) rows.push({ name: 'Resolve', items: alert })
  return rows
}

// What happened, from each side, on one time axis (wireframe 3, borrowed from Razorpay's Ecosystem Health: a strip of rows, one colour per outcome). Whose side it is
// shows before anyone reads the text: the failing stretch is on one row and Razorpay's payments are fine on another. Each row starts with a grey icon for whose it is,
// rows sit on alternating bands, a stretch is a soft fill and a moment a solid dot with its label, and a light dashed line marks when it started, under everything,
// so it never hides a dot. A stretch with no end yet carries the live pulse at its end. The axis is quiet: round times, and the day once in the subtitle.
// On a phone the rows become a list, because a time axis 300px wide cannot carry the labels.
// `rows` and `onset` stand in for an issue that is not one of the engine's own kinds (the brand demo, whose rows come from its own data). Pass `rows` memoised.
// `axis` fixes the time axis to a stretch of one day (the brand demo: 7:30 to 8:10 pm) with a tick every equal step and the time of day only, instead of the issue's own span.
const NAME = 160  // px: the icon and the row's name; two lines for a long name ("Razorpay payments")
export function EvidenceLane({ inc, pack, rows: given, onset, axis: fixed }: { inc?: Inc; pack?: Schemas['EvidencePack']; rows?: Row[]; onset?: string; axis?: { from: string; to: string } }) {
  const { theme } = useTheme()
  const mobile = useBreakpoint({ breakpoints: theme.breakpoints }).matchedDeviceType === 'mobile'
  // A list instead of the time axis on a phone, and in any card narrower than 520px (a laptop with the timeline beside it): below that two labels in a row cannot both be read.
  const [card, room] = useWidth<HTMLDivElement>()
  const phone = mobile || (room > 0 && room < 520)
  const rows = useMemo(() => given ?? rowsFor(inc!, pack), [given, inc, pack])
  // The width of the time axis, measured before the first paint: a label is put on the side of its dot that has room, and cut short only when neither side has.
  const axis = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = axis.current
    if (!el) return
    setW(Math.round(el.getBoundingClientRect().width))
    const watch = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [phone])
  const times = rows.flatMap((r) => r.items.flatMap((i) => [i.at, i.to].filter((t): t is string => !!t))).map((t) => new Date(t).getTime())
  const lo = fixed ? new Date(fixed.from).getTime() : Math.min(...times), hi = fixed ? new Date(fixed.to).getTime() : Math.max(...times)
  const span = fixed ? hi - lo : Math.max(hi - lo, 3_600_000), pad = fixed ? 0 : span * 0.04
  const from = lo - pad, to = lo + span + pad
  const x = (t: string | number) => Math.min(100, Math.max(0, ((new Date(t).getTime() - from) / (to - from)) * 100))
  const iso = (t: number) => new Date(t).toISOString()
  const oneDay = day(iso(from)) === day(iso(to))
  // The ticks. A fixed axis keeps its equal steps (round already). An issue's own axis takes round times when they fit with room between their labels, else equal steps.
  const nTicks = w < 480 ? 3 : fixed ? 5 : 4  // four labels need about 480px of axis; fewer when it is narrower
  const even = Array.from({ length: nTicks }, (_, i) => from + ((to - from) * i) / (nTicks - 1))
  const tickLabel = (t: number, step = 0) => fixed ? clock(iso(t)) : step >= 86_400_000 ? day(iso(t)).split(' ').slice(1).join(' ') : oneDay ? when(iso(t)).split(', ')[1] : when(iso(t)).split(' ').slice(1).join(' ')
  const labelPx = (s: string) => s.length * 5.4 + 4  // about what a 12px muted label takes
  const round = fixed ? null : (() => {
    const r = roundTicks(from, to, nTicks)
    if (!r) return null
    const widest = Math.max(...r.ts.map((t) => labelPx(tickLabel(t, r.step))))
    return (r.step / (to - from)) * w >= widest * 1.5 + 8 ? r : null  // a label pulled in from the edge must still clear its neighbour
  })()
  const ticks = (round?.ts ?? even).map((t) => ({ t, label: tickLabel(t, round?.step) }))
  // On a fixed axis a moment says its time of day after its label ("8.2 rollout  7:40 pm"); a stretch is labelled without one, as its two ends are on the axis.
  const time = (i: Item) => (fixed && !i.to && !i.open ? clock(i.at) : undefined)
  const px = (i: Item) => (i.label.length + (time(i)?.length ?? 0)) * 6.6 + 40  // about what a 12px label, its time and its dot take
  const band = (n: number) => (n % 2 ? 'surface.background.gray.moderate' : 'surface.background.gray.intense') as Bg
  const stamp = (t: string) => (fixed ? clock(t) : oneDay ? when(t).split(', ')[1] : when(t))  // in the list: the time only when the subtitle already says the day
  const subtitle = `When each side saw it, ${oneDay ? day(iso(lo)) : `${day(iso(from))} to ${day(iso(to))}`}`

  return (
    <Panel title="What happened, from each side" subtitle={subtitle} testID="evidence-lane">
      <Box ref={card}>
      {phone ? (
        <Box display="flex" flexDirection="column" gap="spacing.5">
          {rows.map((r) => (
            <Box key={r.name} display="flex" gap="spacing.3" alignItems="flex-start">
              <Tile icon={iconFor(r.name)} />
              <Box display="flex" flexDirection="column" gap="spacing.2" minWidth="spacing.0" paddingTop="spacing.1">
                <Text size="small" weight="semibold" color="surface.text.gray.muted">{r.name}</Text>
                {r.items.map((i) => (
                  <Box key={i.label} display="flex" gap="spacing.3" alignItems="flex-start">
                    <Box paddingTop="spacing.2" flexShrink={0}><Dot item={i} /></Box>
                    <Text>{`${i.label} · ${stamp(i.at)}${i.to ? ` to ${stamp(i.to)}` : ''}`}</Text>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap="spacing.2">
          <Box position="relative">
            {rows.map((r, n) => (
              <Box key={r.name} display="grid" gridTemplateColumns={`${NAME}px minmax(0, 1fr)`} alignItems="center" height="spacing.10" borderRadius="medium" backgroundColor={band(n)} testID={`lane-${r.name}`}>
                <Box display="flex" alignItems="center" gap="spacing.3" paddingX="spacing.3">
                  <Tile icon={iconFor(r.name)} />
                  <Text size="small" weight="semibold" color="surface.text.gray.subtle">{r.name}</Text>
                </Box>
                <Box position="relative" height="spacing.8" marginRight="spacing.4">
                  {r.items.map((i) => i.to || i.open ? (
                    <Box key={i.label}>
                      <Box position="absolute" top="spacing.1" bottom="spacing.1" zIndex={2} left={`${x(i.at)}%`} width={`${Math.max((i.open ? 100 : x(i.to!)) - x(i.at), 2)}%`} borderRadius="medium"
                        backgroundColor={BAR[i.tone] as Bg} display="flex" alignItems="center" paddingLeft="spacing.3" paddingRight={i.open ? 'spacing.8' : 'spacing.3'} overflow="hidden">
                        <Text size="small" weight="medium" color={i.tone === 'neutral' ? 'surface.text.gray.normal' : `feedback.text.${i.tone}.intense` as 'surface.text.gray.normal'} truncateAfterLines={1}>{i.label}</Text>
                      </Box>
                      {/* No end yet: the live pulse sits at the end of the stretch, inside it. */}
                      {i.open && <Box position="absolute" top="spacing.0" bottom="spacing.0" right="spacing.3" zIndex={3} display="flex" alignItems="center"><Dot item={i} /></Box>}
                    </Box>
                  ) : (
                    // A moment: a dot centred on its time and its label, on the side of the dot that has room. When neither side has, the label is cut short with an ellipsis, so it
                    // never leaves the card. The label sits on its row's band colour, so the line where it started passes under it instead of through the words.
                    <Box key={i.label} position="absolute" top="spacing.0" bottom="spacing.0" zIndex={2} display="flex" alignItems="center" gap="spacing.2" whiteSpace="nowrap" overflow="hidden"
                      {...(() => {
                        const at = (x(i.at) / 100) * w, need = px(i)
                        const flip = at + need > w && at > w - at  // more room on the left
                        return flip ? { right: `calc(${100 - x(i.at)}% - 8px)`, flexDirection: 'row-reverse' as const, maxWidth: `${Math.max(at + 8, 60)}px` } : { left: `calc(${x(i.at)}% - 8px)`, maxWidth: `${Math.max(w - at + 8, 60)}px` }
                      })()}>
                      <Dot item={i} ring={band(n)} />
                      <Box display="flex" alignItems="center" gap="spacing.2" minWidth="spacing.0" paddingX="spacing.1" borderRadius="small" backgroundColor={band(n)}>
                        <Text size="small" weight="medium" truncateAfterLines={1}>{i.label}</Text>
                        {time(i) && <Text size="small" color="surface.text.gray.muted">{time(i)}</Text>}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
            {/* The line where it started, across every row, under the dots and labels. */}
            <Box position="absolute" top="spacing.0" bottom="spacing.0" left={`${NAME}px`} right="spacing.4" zIndex={1} pointerEvents="none" testID="onset-line">
              <Box position="absolute" top="spacing.0" bottom="spacing.0" left={`${x(onset ?? inc!.verdict.onset_at)}%`} borderTopWidth="none" borderRightWidth="none" borderBottomWidth="none" borderLeftWidth="thin" borderStyle="dashed" borderColor="surface.border.gray.normal" />
            </Box>
          </Box>
          <Box display="grid" gridTemplateColumns={`${NAME}px minmax(0, 1fr)`}>
            <Box />
            <Box ref={axis} position="relative" height="spacing.6" marginRight="spacing.4" testID="lane-axis">
              {ticks.map(({ t, label }, i) => {
                // Centred on its time with a zero-width box, so a label sits under its time. A label that would run past either end is held at that end instead.
                const at = (x(t) / 100) * w, half = labelPx(label) / 2
                const place = round
                  ? (at < half ? { left: '0%' as const } : w - at < half ? { right: '0%' as const } : { left: `${x(t)}%` as const, width: 'spacing.0' as const, display: 'flex' as const, justifyContent: 'center' as const })
                  : (i === 0 ? { left: '0%' as const } : i === ticks.length - 1 ? { right: '0%' as const } : { left: `${x(t)}%` as const, width: 'spacing.0' as const, display: 'flex' as const, justifyContent: 'center' as const })
                return (
                  <Box key={t} position="absolute" top="spacing.0" {...place} whiteSpace="nowrap">
                    <Text size="xsmall" color="surface.text.gray.muted">{label}</Text>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>
      )}
      </Box>
    </Panel>
  )
}

// Whose row it is: a grey icon on a small white disc.
function Tile({ icon: Icon }: { icon: IconComponent }) {
  return (
    <Box width="spacing.8" height="spacing.8" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center"
      backgroundColor="surface.background.gray.intense" borderWidth="thin" borderColor="surface.border.gray.muted">
      <Icon size="medium" color="surface.icon.gray.muted" />
    </Box>
  )
}

// A moment's dot, in its outcome's colour, with a ring of its band's colour so it stands clear of the line under it. A stretch with no end yet gets the live pulse.
function Dot({ item, ring = 'surface.background.gray.intense' }: { item: Item; ring?: Bg }) {
  const dot = (
    <Box padding="spacing.1" borderRadius="max" flexShrink={0} display="flex" backgroundColor={ring}>
      <Box width="spacing.4" height="spacing.4" borderRadius="max" backgroundColor={DOT[item.tone] as Bg} testID="moment-dot" />
    </Box>
  )
  return item.open ? <Pulse tone={LIVE[item.tone]}>{dot}</Pulse> : dot
}
