import { Box, Text } from '@razorpay/blade/components'
import { hourLabel } from '../lib/format'

export type Hour = { at: string; orders: number; expected: number; zero_attempts: number; probe_checks: number; probe_failed: number; wrote_in: number }

const UNIT = 14 // px per order in an hour
const MAX = 112

// One column per hour. The coloured bar is the orders that arrived: green got a payment attempt, grey did not. The thin line is how many
// orders are normal for that hour. A red strip under the column means the pay page failed its checks that hour.
export function OrdersChart({ hours, marks }: { hours: Hour[]; marks: Record<string, string[]> }) {
  const px = (n: number): `${number}px` => `${Math.min(Math.round(n * UNIT), MAX)}px`
  const marked = hours.filter((h) => marks[h.at]?.length)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box display="flex" alignItems="flex-end" gap="spacing.1" height="128px" aria-label="Orders by hour" testID="orders-chart">
        {hours.map((h) => (
          <Box key={h.at} flex="1" minWidth="3px" height="128px" position="relative" display="flex" flexDirection="column" justifyContent="flex-end">
            {h.expected > 0 && <Box position="absolute" left="0px" right="0px" bottom={`${4 + Math.min(Math.round(h.expected * UNIT), MAX)}px`} borderTopWidth="thin" borderTopColor="surface.border.gray.normal" />}
            <Box height={px(h.zero_attempts)} backgroundColor="feedback.background.neutral.intense" />
            <Box height={px(h.orders - h.zero_attempts)} backgroundColor="feedback.background.positive.intense" />
            <Box height="4px" backgroundColor={h.probe_failed > 0 ? 'feedback.background.negative.intense' : 'surface.background.gray.moderate'} />
          </Box>
        ))}
      </Box>
      <Box display="flex" gap="spacing.5" flexWrap="wrap">
        {([['feedback.background.positive.intense', 'Orders with a payment attempt'], ['feedback.background.neutral.intense', 'Orders nobody tried to pay for'],
          ['feedback.background.negative.intense', 'Pay page failing its checks (strip)'], ['surface.background.gray.moderate', 'Orders normal for that hour (line)']] as const).map(([c, t]) => (
          <Box key={t} display="flex" alignItems="center" gap="spacing.2"><Box width="12px" height="12px" borderRadius="small" backgroundColor={c} /><Text size="small" color="surface.text.gray.subtle">{t}</Text></Box>
        ))}
      </Box>
      <Box display="flex" flexDirection="column" gap="spacing.2">
        {marked.map((h) => (
          <Text key={h.at} size="small">{hourLabel(h.at)} · {marks[h.at].join(' · ')}</Text>
        ))}
      </Box>
    </Box>
  )
}
