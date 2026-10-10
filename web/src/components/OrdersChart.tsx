import { Box, ChartCartesianGrid, ChartLegend, ChartLine, ChartLineWrapper, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { hourLabel } from '../lib/format'

export type Hour = { at: string; orders: number; expected: number; zero_attempts: number; probe_checks: number; probe_failed: number; wrote_in: number }

// Orders by hour as three lines. Green: orders that arrived. Grey dashed: how many are normal for that hour, so a dip reads as a gap between the two.
// Red: orders nobody tried to pay for. Hover a point to read the hour and each count. The hours with something to say are listed under the chart,
// and so is how many hours the pay page failed its checks.
export function OrdersChart({ hours, marks }: { hours: Hour[]; marks: Record<string, string[]> }) {
  const marked = hours.filter((h) => marks[h.at]?.length)
  const failing = hours.filter((h) => h.probe_failed > 0).length
  const data = hours.map((h) => ({ hour: hourLabel(h.at), arrived: h.orders, normal: Math.round(h.expected * 10) / 10, untried: h.zero_attempts }))
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box height="280px" testID="orders-chart">
        <ChartLineWrapper data={data} height="100%">
          <ChartCartesianGrid />
          <ChartXAxis dataKey="hour" interval={Math.max(0, Math.ceil(hours.length / 5) - 1)} />
          <ChartYAxis />
          <ChartTooltip />
          <ChartLegend />
          <ChartLine type="linear" dataKey="arrived" name="Orders that arrived" color="data.background.categorical.green.intense" />
          <ChartLine type="linear" dataKey="normal" name="Normal for that hour" color="data.background.categorical.gray.intense" strokeStyle="dashed" />
          <ChartLine type="linear" dataKey="untried" name="Orders nobody tried to pay for" color="data.background.categorical.red.intense" />
        </ChartLineWrapper>
      </Box>
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Text size="small" color="surface.text.gray.muted">{`Orders by hour over ${hours.length} hours. ` + (failing ? `The pay page failed its checks in ${failing} of them.` : 'The pay page passed its checks in every hour.')}</Text>
        {marked.map((h) => (
          <Text key={h.at} size="small">{hourLabel(h.at)} · {marks[h.at].join(' · ')}</Text>
        ))}
      </Box>
    </Box>
  )
}
