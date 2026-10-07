import { Box, Text } from '@razorpay/blade/components'
import { hourLabel } from '../lib/format'

export type RenewalHour = { at: string; card_ok: number; card_failed: number; upi_ok: number; upi_failed: number }

const UNIT = 14 // px per renewal in an hour
const MAX = 112

// One column per hour. Green: card renewals that went through. Red: card renewals that failed. The thin strip under the column is UPI AutoPay renewals
// that hour: green when they went through, so you can see UPI was fine while cards were not.
export function RenewalChart({ hours, marks }: { hours: RenewalHour[]; marks: Record<string, string[]> }) {
  const px = (n: number): `${number}px` => `${Math.min(Math.round(n * UNIT), MAX)}px`
  const marked = hours.filter((h) => marks[h.at]?.length)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box display="flex" alignItems="flex-end" gap="spacing.1" height="128px" aria-label="Card renewals by hour" testID="renewal-chart">
        {hours.map((h) => (
          <Box key={h.at} flex="1" minWidth="3px" height="128px" display="flex" flexDirection="column" justifyContent="flex-end">
            <Box height={px(h.card_failed)} backgroundColor="feedback.background.negative.intense" />
            <Box height={px(h.card_ok)} backgroundColor="feedback.background.positive.intense" />
            <Box height="4px" backgroundColor={h.upi_failed > 0 ? 'feedback.background.negative.intense' : h.upi_ok > 0 ? 'feedback.background.positive.subtle' : 'surface.background.gray.moderate'} />
          </Box>
        ))}
      </Box>
      <Box display="flex" gap="spacing.5" flexWrap="wrap">
        {([['feedback.background.positive.intense', 'Card renewals that went through'], ['feedback.background.negative.intense', 'Card renewals that failed'],
          ['feedback.background.positive.subtle', 'UPI AutoPay renewals that went through (strip)']] as const).map(([c, t]) => (
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
