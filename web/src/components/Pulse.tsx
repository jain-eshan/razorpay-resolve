import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import { Box, StepItemIndicator, useTheme } from '@razorpay/blade/components'
import { prefersReducedMotion } from '../razorsense'

export type PulseTone = 'primary' | 'notice' | 'negative' | 'positive' | 'information'

// A soft radar ring around the marker of what is live now: the step an issue is on, an issue still open, a stretch with no end yet. One per area, never on a finished
// step (DESIGN.md section 8, "Live pulse"). The ring grows from the marker's edge and fades out, then rests, so it reads as "still happening" without pulling the eye
// while the merchant reads. Timings and colours are Blade tokens. People who ask for less motion get a still, faint ring instead. Framer Motion's `m.span` is the ring,
// because Blade has no animated element; it sits over the marker and takes no room, so the marker keeps its exact size and place inside Blade's own layouts.
export function Pulse({ tone, children }: { tone: PulseTone; children: ReactNode }) {
  const { theme } = useTheme()
  const c = theme.colors
  const color = tone === 'primary' ? c.surface.border.primary.normal : c.feedback.icon[tone].intense
  const { duration, delay } = theme.motion  // two 2xgentle beats to grow, an xgentle rest; the curve is Blade's entrance easing as numbers, which is what Framer Motion takes
  const ring = { position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${color}`, pointerEvents: 'none' } as const
  return (
    <Box position="relative" display="flex" flexShrink={0} testID="live-pulse">
      {children}
      {prefersReducedMotion
        ? <span aria-hidden data-pulse="still" style={{ ...ring, transform: 'scale(1.5)', opacity: 0.3 }} />
        : <m.span aria-hidden data-pulse="moving" style={ring} initial={{ scale: 1, opacity: 0 }} animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
            transition={{ duration: (duration['2xgentle'] * 2) / 1000, ease: [0, 0, 0.2, 1], repeat: Infinity, repeatDelay: delay.xgentle / 1000 }} />}
    </Box>
  )
}

// Blade's timeline dot with the ring, for a `StepItem` marker. StepItem clones its marker to pass `isDisabled`, which this ignores: a live step is never disabled.
export function LiveStepIndicator({ color }: { color: PulseTone }) {
  return <Pulse tone={color}><StepItemIndicator color={color} /></Pulse>
}
