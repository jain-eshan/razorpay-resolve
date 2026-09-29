// The four RazorSense emotional states (see DESIGN.md section 3).
// Gradient stops are copied from Blade's own presets in
// packages/blade/src/components/Spark/docs/GradientEditor.tsx.
// `fallback` is a static tint (Blade palette 100/200) shown when Blade switches the WebGL surface off on slow devices.

export type Emotion = 'calm' | 'joyful' | 'caution' | 'regret'

type Stop = [color: string, position: number]

export const emotions: Record<
  Emotion,
  { label: string; useFor: string; stops: Stop[]; paused: boolean; fallback: string }
> = {
  calm: {
    label: 'Calm',
    fallback: '#D6E5FF, #A8C8FF',
    useFor: 'Idle, loading, Ray thinking',
    stops: [['#8a8fa8', 0], ['#1535cc', 0.2], ['#2255ff', 0.35], ['#55bbff', 0.5], ['#88ffcc', 0.63], ['#ddfff4', 0.78], ['#ffffff', 1]],
    paused: false,
  },
  joyful: {
    label: 'Joyful',
    fallback: '#DBF5E8, #AEF4D4',
    useFor: 'Payment received, task done',
    stops: [['#01C171', 0], ['#4FE19E', 0.1], ['#4EF8E8', 0.3], ['#AEF4D4', 0.5]],
    paused: false,
  },
  caution: {
    label: 'Caution',
    fallback: '#FFE7D6, #FFC9A3',
    useFor: 'Risk, review, irreversible action ahead',
    stops: [['#1a0e00', 0], ['#4d2800', 0.2], ['#cc7700', 0.42], ['#ffaa00', 0.6], ['#ffdd99', 0.65], ['#ffffff', 0.75]],
    paused: false,
  },
  regret: {
    label: 'Regret',
    fallback: '#FBE6E4, #F6C1BC',
    useFor: 'Failure, something went wrong on our side',
    stops: [['#1a0000', 0], ['#4d0000', 0.2], ['#cc0000', 0.42], ['#ff3333', 0.6], ['#ffbbbb', 0.65], ['#ffffff', 0.75]],
    // Regret goes still: the interface stops performing.
    paused: true,
  },
}

// 512x1 lookup texture for RazorSense's `gradientMapCanvas` prop (same as Blade's generateGradientCanvas).
export function gradientCanvas(stops: Stop[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 512, 0)
  for (const [color, position] of stops) gradient.addColorStop(position, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 1)
  return canvas
}

export const RAY_GLYPH =
  'M3 3H7.5H9.74999L12 12L14.25 3H16.5H21V7.5V9.75L12 12L21 14.25V16.5V21H16.5H14.25L12 12L9.74999 21H7.5H3V16.5V14.25L12 12L3 9.75V7.5V3Z'

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
