import type { ReactNode } from 'react'
import { useTheme } from '@razorpay/blade/components'

// The flat pictures on guide cards and in Setup (GuideArt.tsx), in the style of the illustrations on Razorpay's dashboard home: rounded shapes with a blue outline and a pale fill, mint for what is fine, a warm tone for the problem.
// Drawn in code with Blade tokens so they follow the theme. No text. A card names its picture with an `art` id (lib/guides.ts), so one picture serves every card with that idea.
// 240 by 150 canvas. Outlines are 2 wide with round ends.
export function useFlatPalette() {
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
type P = ReturnType<typeof useFlatPalette>

const edge = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const box = (k: string, x: number, y: number, w: number, h: number, fill: string, line: string, r = 8, dash?: string) => <rect key={k} x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={line} strokeDasharray={dash} {...edge} />
const bar = (k: string, x: number, y: number, w: number, p: P, fill = p.grey) => <rect key={k} x={x} y={y} width={w} height={5} rx={2.5} fill={fill} />
const dot = (k: string, cx: number, cy: number, r: number, fill: string, line?: string) => <circle key={k} cx={cx} cy={cy} r={r} fill={fill} stroke={line} {...edge} />
// A person: head and shoulders.
const who = (k: string, cx: number, cy: number, s: number, fill: string, line: string) => (
  <g key={k} fill={fill} stroke={line} {...edge}>
    <circle cx={cx} cy={cy - s * 0.45} r={s * 0.38} />
    <path d={`M${cx - s * 0.75} ${cy + s * 0.75} a${s * 0.75} ${s * 0.6} 0 0 1 ${s * 1.5} 0 z`} />
  </g>
)
const tick = (k: string, cx: number, cy: number, r: number, fill: string, paper: string) => (
  <g key={k}><circle cx={cx} cy={cy} r={r} fill={fill} /><path d={`M${cx - r * 0.45} ${cy} l${r * 0.3} ${r * 0.35} l${r * 0.6} ${-r * 0.7}`} fill="none" stroke={paper} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></g>
)
const bang = (k: string, cx: number, cy: number, r: number, fill: string, paper: string) => (
  <g key={k}><circle cx={cx} cy={cy} r={r} fill={fill} /><path d={`M${cx} ${cy - r * 0.5} v${r * 0.5}`} stroke={paper} strokeWidth={2} strokeLinecap="round" /><circle cx={cx} cy={cy + r * 0.45} r={1.2} fill={paper} /></g>
)
// A list of four customers, some picked out.
const list = (p: P, lit: number[], litFill: string, litLine: string, mark?: (y: number) => ReactNode): ReactNode[] => [
  box('list', 34, 16, 172, 118, p.paper, p.line, 10),
  ...[0, 1, 2, 3].flatMap((i) => {
    const y = 40 + i * 27
    const on = lit.includes(i)
    return [on && <rect key={`h${i}`} x={42} y={y - 12} width={156} height={24} rx={7} fill={litFill} />, who(`p${i}`, 62, y, 9, on ? p.paper : p.soft, on ? litLine : p.grey), bar(`b${i}`, 80, y - 7, 70, p), bar(`c${i}`, 80, y + 3, 44, p), on && mark?.(y)]
  }),
]

const DRAW = {
  // Everyone a problem touched; a few who wrote in are picked out.
  crowd: (p) => list(p, [0, 2], p.wash, p.line),
  // Customers who paid and have no access.
  stuck: (p) => list(p, [0, 1, 3], p.peach, p.orange, (y) => bang(`m${y}`, 182, y, 8, p.orange, p.paper)),
  // Records, and the cause they point to.
  proof: (p) => [box('a', 28, 18, 120, 114, p.paper, p.line, 10), ...[0, 1, 2, 3, 4].map((i) => bar(`r${i}`, 42, 36 + i * 18, i % 2 ? 60 : 84, p)), box('b', 104, 54, 108, 70, p.peach, p.orange, 10), bar('c1', 118, 74, 62, p, p.orange), bar('c2', 118, 90, 40, p, p.orange), bang('m', 196, 62, 10, p.orange, p.paper)],
  // One cause, and the incident it becomes.
  alert: (p) => [dot('c', 120, 54, 30, p.peach, p.orange), <path key="b" d="M120 40 v18" stroke={p.orange} strokeWidth={4} strokeLinecap="round" />, dot('d', 120, 68, 2.6, p.orange), box('k', 56, 98, 128, 36, p.paper, p.line, 8), bar('k1', 70, 108, 80, p), bar('k2', 70, 120, 52, p)],
  // Three places a payment can break; the first and last are in play.
  zones: (p) => [
    box('z1', 18, 46, 56, 58, p.peach, p.orange, 10), dot('z1d', 46, 75, 9, p.orange),
    box('z2', 92, 46, 56, 58, p.soft, p.grey, 10, '4 4'), dot('z2d', 120, 75, 9, p.grey),
    box('z3', 166, 46, 56, 58, p.wash, p.line, 10), dot('z3d', 194, 75, 9, p.blue),
    <path key="a1" d="M78 75 h10 m-4 -4 l4 4 l-4 4" fill="none" stroke={p.line} {...edge} />, <path key="a2" d="M152 75 h10 m-4 -4 l4 4 l-4 4" fill="none" stroke={p.line} {...edge} />,
  ],
  // Nothing to look up: an empty outline where a payment would be.
  inferred: (p) => [box('a', 40, 26, 160, 98, p.paper, p.grey, 12, '5 5'), dot('q', 120, 72, 24, p.wash, p.line), <path key="m" d="M110 66 a10 10 0 1 1 14 9 c-3 2 -4 4 -4 8" fill="none" stroke={p.line} strokeWidth={3} strokeLinecap="round" />, dot('qd', 120, 91, 2.2, p.line), dot('f', 182, 40, 7, p.orange)],
  // Steps up: a dry run, a few, then the rest.
  stairs: (p) => [box('s1', 36, 96, 48, 34, p.wash, p.line, 6), box('s2', 96, 70, 48, 60, p.wash, p.line, 6), box('s3', 156, 44, 48, 86, p.wash, p.line, 6), tick('t', 180, 30, 11, p.green, p.paper), <path key="a" d="M44 84 q40 -8 52 -20 M104 58 q40 -8 52 -20" fill="none" stroke={p.line} strokeDasharray="3 5" {...edge} />],
  // Looking for one thing among many.
  search: (p) => [box('a', 26, 18, 140, 114, p.paper, p.line, 10), ...[0, 1, 2].map((i) => i === 1 ? <rect key={`h${i}`} x={34} y={52} width={124} height={26} rx={7} fill={p.wash} /> : null), ...[0, 1, 2].flatMap((i) => [dot(`d${i}`, 46, 40 + i * 32, 7, p.soft, p.grey), bar(`b${i}`, 62, 34 + i * 32, 72, p), bar(`c${i}`, 62, 44 + i * 32, 46, p)]), dot('lens', 164, 90, 26, p.paper, p.blue), <path key="h" d="M183 109 l22 22" stroke={p.blue} strokeWidth={5} strokeLinecap="round" />],
  // Shut away: a padlock in front of a record.
  lock: (p) => [box('a', 44, 20, 152, 110, p.paper, p.grey, 10), bar('l1', 58, 34, 70, p), bar('l2', 58, 46, 46, p), box('body', 94, 70, 52, 46, p.wash, p.line, 9), <path key="sh" d="M103 70 v-12 a17 17 0 0 1 34 0 v12" fill="none" stroke={p.line} strokeWidth={3} strokeLinecap="round" />, dot('key', 120, 90, 5, p.orange), <path key="kb" d="M120 92 v9" stroke={p.orange} strokeWidth={3} strokeLinecap="round" />],
  // A hub joined to the places customers write from; one is not joined.
  channels: (p) => [
    ...[[52, 42], [188, 42], [52, 110]].map(([x, y], i) => <path key={`l${i}`} d={`M120 75 L${x} ${y}`} stroke={p.line} {...edge} />),
    dot('hub', 120, 75, 22, p.wash, p.line), dot('h2', 120, 75, 8, p.blue),
    ...[[52, 42], [188, 42], [52, 110]].map(([x, y], i) => dot(`s${i}`, x, y, 14, p.paper, p.line)),
    dot('off', 188, 110, 14, p.soft, p.grey),
  ],
  // A customer writes; the assistant answers.
  chat: (p) => [box('a', 22, 22, 118, 52, p.paper, p.line, 14), bar('a1', 38, 38, 70, p), bar('a2', 38, 50, 48, p), box('b', 100, 84, 118, 48, p.wash, p.line, 14), bar('b1', 116, 99, 66, p, p.line), bar('b2', 116, 111, 40, p, p.line), tick('t', 206, 84, 10, p.green, p.paper)],
  // Control passes from the assistant to a person, with the thread.
  handover: (p) => [dot('ray', 54, 78, 28, p.mint, p.green), <path key="sp" d="M54 64 v28 M40 78 h28" stroke={p.green} strokeWidth={3} strokeLinecap="round" />, who('you', 186, 80, 24, p.wash, p.line), <path key="ar" d="M94 78 h50 m-8 -8 l8 8 l-8 8" fill="none" stroke={p.line} {...edge} />, box('t', 100, 34, 44, 28, p.paper, p.grey, 7), bar('t1', 108, 43, 28, p), bar('t2', 108, 52, 18, p)],
  // A person approves.
  approve: (p) => [box('a', 26, 18, 122, 114, p.paper, p.line, 10), ...[0, 1, 2].map((i) => bar(`b${i}`, 40, 36 + i * 18, i === 2 ? 50 : 84, p)), box('btn', 88, 96, 92, 28, p.blue, p.blue, 8), bar('bt', 106, 107, 56, p, p.paper), tick('t', 174, 32, 15, p.green, p.paper)],
  // A line that stops at a gate.
  gate: (p) => [<path key="g" d="M20 112 h200" stroke={p.grey} {...edge} />, dot('r', 50, 96, 14, p.mint, p.green), <path key="d" d="M70 96 h70" stroke={p.line} strokeDasharray="3 6" {...edge} />, box('p1', 150, 56, 7, 56, p.peach, p.orange, 3), box('p2', 196, 56, 7, 56, p.peach, p.orange, 3), box('br', 150, 56, 53, 8, p.peach, p.orange, 3)],
  // Settings that move one notch.
  sliders: (p) => [...[[48, 100], [100, 70]].flatMap(([y, x], r) => [<rect key={`t${r}`} x={30} y={y - 4} width={180} height={8} rx={4} fill={p.soft} stroke={p.grey} strokeWidth={1.5} />, <circle key={`g${r}`} cx={x + 30} cy={y} r={11} fill="none" stroke={p.line} strokeDasharray="3 4" {...edge} />, dot(`k${r}`, x, y, 11, p.paper, p.line), dot(`n${r}`, x, y, 4, p.blue)])],
  // A written record, in order.
  log: (p) => [<path key="v" d="M62 24 V126" stroke={p.grey} {...edge} />, ...[0, 1, 2].flatMap((i) => [dot(`d${i}`, 62, 34 + i * 41, 8, i === 0 ? p.blue : p.wash, i === 0 ? p.blue : p.line), bar(`b${i}`, 84, 28 + i * 41, 96, p), bar(`c${i}`, 84, 40 + i * 41, 64, p)])],
  // A week, and the one day that changes.
  calendar: (p) => [box('a', 36, 20, 168, 112, p.paper, p.line, 10), <path key="h" d="M38 46 V30 a8 8 0 0 1 8 -8 h148 a8 8 0 0 1 8 8 V46 z" fill={p.wash} />, ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={`c${i}`} x={52 + (i % 4) * 36} y={60 + Math.floor(i / 4) * 32} width={24} height={22} rx={5} fill={i === 5 ? p.blue : p.soft} />)],
  // A row of checks that passed.
  report: (p) => [box('a', 34, 18, 172, 114, p.paper, p.line, 10), ...[0, 1, 2, 3].flatMap((i) => [tick(`t${i}`, 58, 40 + i * 26, 9, p.green, p.paper), bar(`b${i}`, 76, 35 + i * 26, i % 2 ? 80 : 104, p)])],
  // A link that can be cut: a switch, off.
  switch: (p) => [box('track', 66, 54, 108, 44, p.soft, p.grey, 22), dot('knob', 88, 76, 16, p.paper, p.grey), box('ghost', 66, 108, 108, 20, 'none', p.line, 10, '4 5'), <path key="p" d="M120 40 v10" stroke={p.line} {...edge} />],
} satisfies Record<string, (p: P) => ReactNode[]>

export type ArtId = keyof typeof DRAW

// A picture by id. A plain function, not a component, so this file exports no components (fast refresh).
export function flatArt(id: ArtId, p: P) {
  return (
    <svg viewBox="0 0 240 150" aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }}>
      {(DRAW[id] as (p: P) => ReactNode[])(p)}
    </svg>
  )
}
