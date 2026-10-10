import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartLegend, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { hourLabel } from '../lib/format'

export type RenewalHour = { at: string; card_ok: number; card_failed: number; upi_ok: number; upi_failed: number }

// Card renewals by hour, stacked. Green: went through. Red: failed. Hover a bar to read the hour and each count. UPI AutoPay renewals are not drawn: the line
// under the chart adds them up over the same hours, so you can see UPI was fine while cards were not. The hours with something to say are listed below it.
export function RenewalChart({ hours, marks }: { hours: RenewalHour[]; marks: Record<string, string[]> }) {
  const marked = hours.filter((h) => marks[h.at]?.length)
  const upiOk = hours.reduce((n, h) => n + h.upi_ok, 0)
  const upiFailed = hours.reduce((n, h) => n + h.upi_failed, 0)
  const data = hours.map((h) => ({ hour: hourLabel(h.at), ok: h.card_ok, failed: h.card_failed }))
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box height="280px" testID="renewal-chart">
        <ChartBarWrapper data={data} height="100%">
          <ChartCartesianGrid />
          <ChartXAxis dataKey="hour" interval={Math.max(0, Math.ceil(hours.length / 5) - 1)} />
          <ChartYAxis />
          <ChartTooltip />
          <ChartLegend />
          <ChartBar dataKey="ok" name="Card renewals that went through" color="data.background.categorical.green.intense" stackId="cards" />
          <ChartBar dataKey="failed" name="Card renewals that failed" color="data.background.categorical.red.intense" stackId="cards" />
        </ChartBarWrapper>
      </Box>
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Text size="small" color="surface.text.gray.muted">{`Card renewals by hour. UPI AutoPay in the same hours: ${upiOk} renewals went through and ${upiFailed} failed.`}</Text>
        {marked.map((h) => (
          <Text key={h.at} size="small">{hourLabel(h.at)} · {marks[h.at].join(' · ')}</Text>
        ))}
      </Box>
    </Box>
  )
}
