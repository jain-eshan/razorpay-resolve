import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { Box, CheckIcon, Heading, RazorSense, Text, preloadRazorSenseAssets } from '@razorpay/blade/components'
import { emotions, prefersReducedMotion } from '../razorsense'

// The one RazorSense surface on the incident page (Joyful: the incident is closed). The static tint sits behind it, because Blade hides the canvas on slow devices.
export function SuccessMoment({ heading, detail }: { heading: string; detail: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    preloadRazorSenseAssets('circleSlideUp').then(() => setReady(true), () => setReady(true))
  }, [])
  return (
    <Box position="relative" height="320px" borderRadius="large" overflow="hidden" display="flex" alignItems="center" justifyContent="center" testID="success-moment">
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${emotions.joyful.fallback})` }} />
      {ready && (
        <Box position="absolute" top="0px" left="0px" right="0px" bottom="0px">
          <RazorSense preset="circleSlideUp" edgeFeather={[0, 0, 0.2, 0]} paused={prefersReducedMotion} />
        </Box>
      )}
      <m.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut' }}
        style={{ position: 'relative', textAlign: 'center' }}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.4" paddingX="spacing.5">
          <Box backgroundColor="feedback.background.positive.subtle" borderRadius="max" width="64px" height="64px" display="flex" alignItems="center" justifyContent="center">
            <CheckIcon size="2xlarge" color="feedback.icon.positive.intense" />
          </Box>
          <Heading size="large">{heading}</Heading>
          <Text color="surface.text.gray.subtle">{detail}</Text>
        </Box>
      </m.div>
    </Box>
  )
}
