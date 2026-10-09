import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartLegend, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { dayLabel } from '../lib/format'
import type { Schemas } from '../lib/api'

// One bar per day of the Android version's orders, stacked. Green: orders that were fine. Red: the second order of a double tap.
// Hover a bar to read the day and each count. The days with something to say are listed under the chart.
export function DuplicateChart({ buckets }: { buckets: Schemas['TimelineBucket'][] }) {
  const marked = buckets.filter((b) => b.markers.length)
  const data = buckets.map((b) => ({ day: dayLabel(b.bucket_start), fine: b.ok, doubled: b.server_error }))
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box height="280px" testID="duplicate-chart">
        <ChartBarWrapper data={data} height="100%">
          <ChartCartesianGrid />
          <ChartXAxis dataKey="day" interval={0} />
          <ChartYAxis />
          <ChartTooltip />
          <ChartLegend />
          <ChartBar dataKey="fine" name="Orders that were fine" color="data.background.categorical.green.intense" stackId="orders" />
          <ChartBar dataKey="doubled" name="Second order of a double tap" color="data.background.categorical.red.intense" stackId="orders" />
        </ChartBarWrapper>
      </Box>
      <Box display="flex" flexDirection="column" gap="spacing.2">
        {marked.map((b) => (
          <Text key={b.bucket_start} size="small">
            {dayLabel(b.bucket_start)} · {b.markers.join(' · ')}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
