import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useBreakpoint } from '@razorpay/blade/utils'
import { Box, Text, useTheme } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { when } from '../lib/format'
import { clock } from '../lib/brand'
import { useWidth } from '../lib/useWidth'
import { Panel } from './Panel'

export type Tone = 'negative' | 'positive' | 'notice' | 'information' | 'neutral'
export type Item = { at: string; to?: string; open?: boolean; label: string; tone: Tone }  // a moment, or a stretch of time when `to` is given; `open`: it has no end yet, so it runs to the edge of the axis
export type Row = { name: string; items: Item[] }
type Inc = Pick<Schemas['IncidentDetail'], 'mismatch_type' | 'onset_at' | 'would_have_alerted_at'> & { verdict: Pick<Schemas['IncidentDetail']['verdict'], 'onset_at' | 'resolved_at' | 'signature'> }
const BAR: Record<Tone, string> = { negative: 'feedback.background.negative.subtle', positive: 'feedback.background.positive.subtle', notice: 'feedback.background.notice.subtle', information: 'feedback.background.information.subtle', neutral: 'surface.background.gray.moderate' }
const EDGE: Record<Tone, string> = { negative: 'feedback.border.negative.muted', positive: 'feedback.border.positive.muted', notice: 'feedback.border.notice.muted', information: 'feedback.border.information.muted', neutral: 'surface.border.gray.normal' }

// The rows of the lane for each kind of issue, from what the engine saved: when your change went live, when the failures ran, what Razorpay recorded in the same hours,
// and when Blindspot would have alerted. A row is left out when it would say nothing true (Razorpay's payments were not fine in a gateway issue; nothing changed on
// your side in one that is Razorpay's).
function rowsFor(inc: Inc, pack?: Schemas['EvidencePack']): Row[] {
  const v = inc.verdict, sig = v.signature as Record<string, unknown>
  const str = (k: string) => (typeof sig[k] === 'string' ? (sig[k] as string) : undefined)
  const end = v.resolved_at ?? pack?.last_failure_at ?? undefined
  const change = pack?.linked_change?.split(':')[0]
  const alert = inc.would_have_alerted_at ? [{ at: inc.would_have_alerted_at, label: 'Blindspot would have alerted', tone: 'information' as const }] : []
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
  if (alert.length) rows.push({ name: 'Blindspot', items: alert })
  return rows
}

// What happened, from each side, on one time axis (wireframe 3, borrowed from Razorpay's Ecosystem Health: a strip of rows, one colour per outcome). Whose side it is
// shows before anyone reads the text: the failing stretch is on one row and Razorpay's payments are fine on another. A dashed line marks when it started.
// On a phone the rows become a list, because a time axis 300px wide cannot carry the labels.
// `rows` and `onset` stand in for an issue that is not one of the engine's own kinds (the brand demo, whose rows come from its own data). Pass `rows` memoised.
// `axis` fixes the time axis to a stretch of one day (the brand demo: 7:30 to 8:10 pm) with a tick every equal step and the time of day only, instead of the issue's own span.
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
  const x = (t: string) => Math.min(100, Math.max(0, ((new Date(t).getTime() - (lo - pad)) / (span + pad * 2)) * 100))
  const nTicks = w < 480 ? 3 : fixed ? 5 : 4  // four labels need about 480px of axis; fewer when it is narrower
  const ticks = Array.from({ length: nTicks }, (_, i) => new Date(lo - pad + ((span + pad * 2) * i) / (nTicks - 1)).toISOString())
  // On a fixed axis a moment says its time of day after its label ("8.2 rollout, 7:40 pm"); a stretch is labelled without one, as its two ends are on the axis.
  const said = (i: Item) => (fixed && !i.to && !i.open ? `${i.label}, ${clock(i.at)}` : i.label)
  const px = (label: string) => label.length * 6.6 + 28  // about what a 12px label and its dot take

  return (
    <Panel title="What happened, from each side" subtitle="When each side saw it, on one time axis" testID="evidence-lane">
      <Box ref={card}>
      {phone ? (
        <Box display="flex" flexDirection="column" gap="spacing.4">
          {rows.map((r) => (
            <Box key={r.name} display="flex" flexDirection="column" gap="spacing.1">
              <Text size="small" weight="semibold" color="surface.text.gray.muted">{r.name}</Text>
              {r.items.map((i) => <Text key={i.label}>{`${i.label} · ${fixed ? clock(i.at) : when(i.at)}${i.to ? ` to ${fixed ? clock(i.to) : when(i.to)}` : ''}`}</Text>)}
            </Box>
          ))}
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <Box position="relative">
            {rows.map((r) => (
              <Box key={r.name} display="grid" gridTemplateColumns="140px minmax(0, 1fr)" alignItems="center" height="spacing.10" testID={`lane-${r.name}`}>
                <Text size="small" weight="semibold" color="surface.text.gray.muted">{r.name}</Text>
                <Box position="relative" height="spacing.8">
                  <Box position="absolute" top="spacing.5" left="spacing.0" right="spacing.0" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle" />
                  {r.items.map((i) => i.to || i.open ? (
                    <Box key={i.label} position="absolute" top="spacing.2" left={`${x(i.at)}%`} width={`${Math.max((i.open ? 100 : x(i.to!)) - x(i.at), 2)}%`} height="spacing.7" borderRadius="max" borderWidth="thin" borderColor={EDGE[i.tone] as 'surface.border.gray.normal'}
                      backgroundColor={BAR[i.tone] as 'surface.background.gray.moderate'} display="flex" alignItems="center" paddingX="spacing.3" overflow="hidden">
                      <Text size="small" truncateAfterLines={1}>{i.label}</Text>
                    </Box>
                  ) : (
                    // A moment: a dot and its label, on the side of the dot that has room. When neither side has, the label is cut short with an ellipsis, so it never leaves the card.
                    <Box key={i.label} position="absolute" top="spacing.2" backgroundColor="surface.background.gray.intense" paddingRight="spacing.2" borderRadius="medium" display="flex" alignItems="center" gap="spacing.2" whiteSpace="nowrap" overflow="hidden"
                      {...(() => {
                        const at = (x(i.at) / 100) * w, need = px(said(i))
                        const right = at + need > w && at > w - at  // more room on the left
                        return right ? { right: `${100 - x(i.at)}%`, flexDirection: 'row-reverse' as const, maxWidth: `${Math.max(at, 60)}px` } : { left: `${x(i.at)}%`, maxWidth: `${Math.max(w - at, 60)}px` }
                      })()}>
                      <Box width="spacing.4" height="spacing.4" borderRadius="max" flexShrink={0} backgroundColor={i.tone === 'information' ? 'feedback.background.information.intense' : i.tone === 'positive' ? 'feedback.background.positive.intense' : 'surface.background.gray.intense'} borderWidth="thick" borderColor={EDGE[i.tone] as 'surface.border.gray.normal'} />
                      <Text size="small" truncateAfterLines={1}>{said(i)}</Text>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
            {/* The line where it started, across every row. */}
            <Box position="absolute" top="spacing.0" bottom="spacing.0" left="140px" right="spacing.0" pointerEvents="none">
              <Box position="absolute" top="spacing.0" bottom="spacing.0" left={`${x(onset ?? inc!.verdict.onset_at)}%`} borderLeftWidth="thin" borderStyle="dashed" borderLeftColor="surface.border.primary.normal" />
            </Box>
          </Box>
          <Box display="grid" gridTemplateColumns="140px minmax(0, 1fr)">
            <Box />
            <Box ref={axis} position="relative" height="spacing.7" testID="lane-axis">
              {ticks.map((t, i) => (
                // Centred on its time with a zero-width box, so a label sits under its time and four of them cannot run into each other. The first and last are pinned to the edges.
                <Box key={t} position="absolute" top="spacing.0" {...(i === 0 ? { left: '0%' } : i === nTicks - 1 ? { right: '0%' } : { left: `${(i / (nTicks - 1)) * 100}%`, width: 'spacing.0', display: 'flex' as const, justifyContent: 'center' as const })} whiteSpace="nowrap">
                  <Text size="xsmall" color="surface.text.gray.muted">{fixed ? clock(t) : when(t).split(' ').slice(1).join(' ')}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
      </Box>
    </Panel>
  )
}
