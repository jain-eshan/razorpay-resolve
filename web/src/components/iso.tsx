import type { ReactNode } from 'react'
import { useTheme } from '@razorpay/blade/components'

// The drawing kit for the guide heroes (IsoScenes.tsx): isometric blocks and people as plain SVG, coloured with Blade tokens so they follow dark mode and carry no text.
// One unit is S pixels. x runs down and to the right, y down and to the left, z up.
const S = 22
export const iso = (x: number, y: number, z: number): [number, number] => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - z * S]
const pts = (ps: [number, number][]) => ps.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')

export type Item = { depth: number; node: ReactNode }

// One block. The top face is the colour given, the two side faces are the same colour darkened, so one token gives all three.
export function block(key: string, x: number, y: number, z: number, w: number, d: number, h: number, fill: string, edge: string, opacity = 1): Item {
  const top = pts([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)])
  const right = pts([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)])
  const left = pts([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)])
  return {
    depth: x + w / 2 + y + d / 2 + z * 0.01,
    node: (
      <g key={key} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" opacity={opacity}>
        <polygon points={left} fill={fill} style={{ filter: 'brightness(0.82)' }} />
        <polygon points={right} fill={fill} style={{ filter: 'brightness(0.92)' }} />
        <polygon points={top} fill={fill} />
      </g>
    ),
  }
}

// A customer: a small post with a round head.
export function person(key: string, x: number, y: number, z: number, fill: string, edge: string, scale = 1): Item[] {
  const [hx, hy] = iso(x + 0.3 * scale, y + 0.3 * scale, z + 1.45 * scale)
  return [
    block(`${key}b`, x, y, z, 0.6 * scale, 0.6 * scale, 1.1 * scale, fill, edge),
    { depth: x + 0.3 * scale + y + 0.3 * scale + z * 0.01 + 0.02, node: <circle key={`${key}h`} cx={hx} cy={hy} r={0.42 * S * scale} fill={fill} stroke={edge} strokeWidth={0.8} /> },
  ]
}

// Draw these after everything else. For things standing on a tall block, whose centre sorts them behind it.
export const onTop = (its: Item | Item[]): Item[] => [its].flat().map((it) => ({ ...it, depth: it.depth + 100 }))

// A flat tile everything else stands on. Things on it sit at z = TOP.
export const TOP = 0.5
// Tiles always draw first: sorting a big tile by its centre would put it on top of things standing at its back.
export const tile = (key: string, x: number, y: number, w: number, d: number, fill: string, edge: string): Item => ({ ...block(key, x, y, 0, w, d, TOP, fill, edge), depth: -1e9 })

// An arrow lying on the ground, pointing right-and-down along x.
export function arrow(key: string, x: number, y: number, fill: string): ReactNode {
  const [ax, ay] = iso(x, y, TOP + 0.01)
  return <polygon key={key} points={`${ax - 7},${ay - 7} ${ax + 7},${ay} ${ax - 7},${ay + 7}`} fill={fill} />
}

export function useIsoPalette() {
  const { theme } = useTheme()
  const c = theme.colors
  return {
    white: c.surface.background.gray.intense,
    grey: c.surface.background.gray.moderate,
    muted: c.surface.border.gray.normal,
    blue: c.interactive.background.primary.default,
    soft: c.surface.background.primary.moderate,
    orange: c.feedback.background.notice.intense,
    green: c.feedback.background.positive.intense,
    ink: c.surface.text.gray.muted,
    edge: c.surface.border.gray.subtle,
  }
}

// The frame every scene is drawn into. A plain function, not a component, so this file exports no components and fast refresh stays happy. `fit` fills the height of its box (cards); a scene with no label is decoration and is hidden from screen readers. Items are sorted back to front so nearer blocks cover farther ones; `over` is drawn last (arrows).
export function isoSvg({ label, items, over, viewBox = '-345 -200 690 400', fit = false }: { label: string; items: Item[]; over?: ReactNode; viewBox?: string; fit?: boolean }) {
  const sorted = [...items].sort((p, q) => p.depth - q.depth)
  return (
    <svg viewBox={viewBox} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} style={{ width: '100%', height: fit ? '100%' : 'auto', display: 'block' }}>
      {sorted.map((it) => it.node)}
      {over}
    </svg>
  )
}

// The soft mint-to-blue wash behind a guide's hero and the welcome card, as on Razorpay's agent pages: Blade's positive green and primary blue, thinned to a tint on white, so it stays clean on the grey page too.
export function useHeroWash() {
  const { theme } = useTheme()
  const c = theme.colors
  const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`
  return `linear-gradient(135deg, ${tint(c.feedback.background.positive.intense, 16)}, ${tint(c.interactive.background.primary.default, 18)}), ${c.surface.background.gray.intense}`
}
