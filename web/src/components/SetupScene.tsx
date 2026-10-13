import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import { Box, CheckCircleIcon, HeadsetIcon, MailIcon, RayIcon, UserCheckIcon, UsersIcon, useTheme, WhatsAppIcon, type IconComponent } from '@razorpay/blade/components'
import { prefersReducedMotion } from '../razorsense'

// The colours of the moving setup picture, from Blade tokens so it follows the theme.
function useFlatPalette() {
  const { theme } = useTheme()
  const c = theme.colors
  return {
    line: c.interactive.border.primary.default,
    paper: c.surface.background.gray.intense,
    wash: c.surface.background.primary.moderate,
    grey: c.surface.border.gray.normal,
    soft: c.surface.background.gray.moderate,
    mint: c.feedback.background.positive.subtle,
    green: c.feedback.background.positive.intense,
    peach: c.feedback.background.notice.subtle,
    orange: c.feedback.background.notice.intense,
    blue: c.interactive.background.primary.default,
  }
}

// The picture in Setup's left card. It answers the question on the right as you answer it: on Channels the places you tick light up and send
// messages to Ray, on Autonomy the messages stop at you, pass after one approval, or run on their own inside a limit, and on First scan a line sweeps
// the customers and the stuck ones turn orange. Drawn in code with Blade's tokens and icons, in the flat style of FlatArt.tsx. No text in the picture;
// the label says it in words. It plays three times each time a choice changes, then rests, so nothing keeps moving while the merchant reads
// (DESIGN.md section 21). Timings are Blade's motion tokens. People who ask for less motion get the still picture (section 8).
const W = 240
const H = 160
const EASE = [0.3, 0, 0.2, 1] as const  // Blade's standard easing
const T = 0.96, HALF = 0.48  // Blade's 2xgentle duration and gentle delay, in seconds
const TIMES = 3  // plays, after the first, each time a choice changes

type Pt = readonly [number, number]

// A Blade icon in a round tile, placed over the drawing. Blue when it is in use, green for Ray, grey when it is off.
function Tile({ at: [x, y], icon: Icon, tone, size = 36 }: { at: Pt; icon: IconComponent; tone: 'blue' | 'green' | 'off'; size?: number }) {
  const bg = tone === 'blue' ? 'surface.background.primary.subtle' : tone === 'green' ? 'feedback.background.positive.subtle' : 'surface.background.gray.moderate'
  const ic = tone === 'blue' ? 'surface.icon.primary.normal' : tone === 'green' ? 'surface.icon.onSea.onSubtle' : 'surface.icon.gray.muted'
  return (
    <Box position="absolute" left={`${x - size / 2}px`} top={`${y - size / 2}px`} width={`${size}px`} height={`${size}px`} borderRadius="max" backgroundColor={bg}
      borderWidth="thin" borderColor="surface.border.gray.muted" display="flex" alignItems="center" justifyContent="center" elevation="lowRaised">
      <Icon size={size > 40 ? 'large' : 'medium'} color={ic} />
    </Box>
  )
}

// A message moving along a straight line, a few times.
function Dot({ from, to, color, delay = 0, dur = T, rest = 0 }: { from: Pt; to: Pt; color: string; delay?: number; dur?: number; rest?: number }) {
  if (prefersReducedMotion) return null
  return (
    <m.circle r={3.5} fill={color} initial={{ cx: from[0], cy: from[1], opacity: 0 }}
      animate={{ cx: [from[0], to[0]], cy: [from[1], to[1]], opacity: [0, 1, 1, 0] }}
      transition={{ duration: dur, delay, repeat: TIMES, repeatDelay: rest, ease: 'linear' }} />
  )
}

function Stage({ label, children, tiles }: { label: string; children: ReactNode; tiles: ReactNode }) {
  return (
    <Box height="200px" backgroundColor="surface.background.gray.subtle" borderRadius="medium" display="flex" alignItems="center" justifyContent="center" overflow="hidden" testID="setup-scene">
      <Box position="relative" width={`${W}px`} height={`${H}px`} flexShrink={0}>
        <Box position="absolute" top="spacing.0" left="spacing.0"><svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>{children}</svg></Box>
        {tiles}
      </Box>
    </Box>
  )
}

const CH: [string, IconComponent, number][] = [['help_button', HeadsetIcon, 32], ['whatsapp_payments', WhatsAppIcon, 80], ['email', MailIcon, 128]]
const LEVEL_LABEL: Record<string, string> = {
  suggest: 'Each step from Ray stops at you before it reaches customers.',
  assist: 'You approve a fix once, then it runs in stages. Messages to customers still stop at you.',
  autopilot_reversible: 'Steps run on to customers by themselves, inside your limits.',
}
// Customers in the scan, in a grid; the stuck ones are fixed so the picture is the same every time. It is a picture, not the count.
const PEOPLE = Array.from({ length: 18 }, (_, i) => [36 + (i % 6) * 34, 48 + Math.floor(i / 6) * 32] as const)
const STUCK = new Set([1, 8, 10, 15])

export function SetupScene({ step, channels, level }: { step: number; channels: string[]; level: string }) {
  const p = useFlatPalette()
  const line = { strokeWidth: 2, strokeLinecap: 'round' } as const

  if (step === 0) {
    const hub: Pt = [184, 80]
    const on = CH.filter(([k]) => channels.includes(k)).map(([k]) => k)
    return (
      <Stage key={channels.join()} label={on.length ? `${on.length} of 3 places connected. Their messages reach Resolve.` : 'No places connected yet.'}
        tiles={<>{CH.map(([k, icon, y]) => <Tile key={k} at={[40, y]} icon={icon} tone={channels.includes(k) ? 'blue' : 'off'} />)}<Tile at={hub} icon={RayIcon} tone="green" size={48} /></>}>
        {CH.map(([k, , y]) => {
          const lit = channels.includes(k)
          return <path key={k} d={`M58 ${y} L${hub[0] - 24} ${hub[1]}`} stroke={lit ? p.line : p.grey} strokeDasharray={lit ? undefined : '3 5'} {...line} />
        })}
        {CH.map(([k, , y], i) => channels.includes(k) && [0, HALF].map((d) => <Dot key={`${k}${d}`} from={[58, y]} to={[hub[0] - 24, hub[1]]} color={p.blue} delay={i * 0.16 + d} />))}
      </Stage>
    )
  }

  if (step === 1) {
    const ray: Pt = [36, 80], you: Pt = [120, 80], them: Pt = [204, 80]
    const a: [Pt, Pt] = [[54, 80], [100, 80]], b: [Pt, Pt] = [[140, 80], [186, 80]]
    const auto = level === 'autopilot_reversible'
    return (
      <Stage key={level} label={LEVEL_LABEL[level] ?? ''}
        tiles={<>
          <Tile at={ray} icon={RayIcon} tone="green" />
          <Tile at={you} icon={UserCheckIcon} tone={auto ? 'off' : 'blue'} size={44} />
          <Tile at={them} icon={UsersIcon} tone="blue" />
          {level === 'assist' && <Box position="absolute" left={`${you[0] + 8}px`} top={`${you[1] - 30}px`} backgroundColor="surface.background.gray.intense" borderRadius="max" display="flex"><CheckCircleIcon size="medium" color="feedback.icon.positive.intense" /></Box>}
        </>}>
        {auto && <rect x={14} y={46} width={212} height={68} rx={34} fill="none" stroke={p.grey} strokeDasharray="4 6" {...line} />}
        <path d={`M${a[0][0]} 80 H${a[1][0]} M${b[0][0]} 80 H${b[1][0]}`} stroke={p.line} {...line} />
        {!auto && <>
          {/* A step goes to you, waits while you look, and only then goes on to customers. On Assist the fix is approved once (the tick), but a message
              to customers still stops here, so the picture is the same path without the pulse. */}
          <Dot from={a[0]} to={a[1]} color={p.green} rest={T + HALF} />
          <Dot from={b[0]} to={b[1]} color={p.blue} delay={T + HALF} rest={T + HALF} />
          {level === 'suggest' && !prefersReducedMotion && <m.circle cx={you[0]} cy={you[1]} fill="none" stroke={p.blue} strokeWidth={2} initial={{ r: 24, opacity: 0 }}
            animate={{ r: [24, 24, 30, 24, 24], opacity: [0, 0, 0.6, 0, 0] }} transition={{ duration: 2 * T + HALF, times: [0, 0.4, 0.5, 0.6, 1], repeat: TIMES, ease: EASE }} />}
        </>}
        {auto && [0, HALF].map((d) => <Dot key={d} from={a[0]} to={b[1]} color={p.blue} dur={2 * T} delay={d} />)}
      </Stage>
    )
  }

  // The sweep crosses in two 960ms steps and holds for one, a few times, and ends on the result. Each customer changes colour as the line passes it.
  const sweep = 2 * T, cycle = 3 * T, x0 = 16, x1 = 224
  return (
    <Stage label="A check passes over every customer. The ones who paid and did not get access turn orange." tiles={null}>
      {PEOPLE.map(([x, y], i) => {
        const bad = STUCK.has(i)
        const fill = bad ? p.peach : p.mint, stroke = bad ? p.orange : p.green
        if (prefersReducedMotion) return <circle key={i} cx={x} cy={y} r={9} fill={fill} stroke={stroke} strokeWidth={2} />
        const t = ((x - x0) / (x1 - x0)) * (sweep / cycle)
        return <m.circle key={i} cx={x} cy={y} r={9} strokeWidth={2} initial={{ fill: p.soft, stroke: p.grey }}
          animate={{ fill: [p.soft, p.soft, fill, fill], stroke: [p.grey, p.grey, stroke, stroke] }}
          transition={{ duration: cycle, times: [0, t, t + 0.03, 1], repeat: TIMES - 1, ease: 'linear' }} />
      })}
      {!prefersReducedMotion && <m.rect y={24} width={3} height={112} rx={1.5} fill={p.blue} initial={{ x: x0, opacity: 0 }}
        animate={{ x: [x0, x1, x1], opacity: [0.8, 0.8, 0] }} transition={{ duration: cycle, times: [0, sweep / cycle, 1], repeat: TIMES - 1, ease: 'linear' }} />}
    </Stage>
  )
}
