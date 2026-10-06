import { Box, Text } from '@razorpay/blade/components'
import { hourLabel } from '../lib/format'
import type { Schemas } from '../lib/api'

const UNIT = 16 // px per event in an hour

// One column per hour. Green: delivered. Red: your server answered with an error. Grey: nothing was sent because the webhook was off.
export function TimelineChart({ buckets }: { buckets: Schemas['TimelineBucket'][] }) {
  const marked = buckets.filter((b) => b.markers.length)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box display="flex" alignItems="flex-end" gap="spacing.1" height="96px" aria-label="Webhook outcomes by hour">
        {buckets.map((b) => {
          const seg = (n: number): `${number}px` => `${Math.min(n * UNIT, 96)}px`
          return (
            <Box key={b.bucket_start} flex="1" display="flex" flexDirection="column" justifyContent="flex-end" minWidth="3px"
>
              <Box height={seg(b.not_attempted)} backgroundColor="feedback.background.neutral.intense" />
              <Box height={seg(b.client_error + b.server_error)} backgroundColor="feedback.background.negative.intense" />
              <Box height={seg(b.ok)} backgroundColor="feedback.background.positive.intense" />
            </Box>
          )
        })}
      </Box>
      <Box display="flex" gap="spacing.5" flexWrap="wrap">
        <Text size="small" color="feedback.text.positive.intense">Delivered</Text>
        <Text size="small" color="feedback.text.negative.intense">Your server returned an error</Text>
        <Text size="small" color="surface.text.gray.muted">Nothing sent, webhook off</Text>
      </Box>
      <Box display="flex" flexDirection="column" gap="spacing.2">
        {marked.map((b) => (
          <Text key={b.bucket_start} size="small">
            {hourLabel(b.bucket_start)} · {b.markers.join(' · ')}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
