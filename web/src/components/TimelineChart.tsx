import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartLegend, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { hourLabel } from '../lib/format'
import type { Schemas } from '../lib/api'

// One bar per hour, stacked. Green: delivered. Red: your server answered with an error. Grey: nothing was sent because the webhook was off.
// Hover a bar to read the hour and each count. The hours with something to say are listed under the chart.
export function TimelineChart({ buckets }: { buckets: Schemas['TimelineBucket'][] }) {
  const marked = buckets.filter((b) => b.markers.length)
  const data = buckets.map((b) => ({ hour: hourLabel(b.bucket_start), delivered: b.ok, errors: b.client_error + b.server_error, off: b.not_attempted }))
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box height="280px" testID="timeline-chart">
        <ChartBarWrapper data={data} height="100%">
          <ChartCartesianGrid />
          <ChartXAxis dataKey="hour" interval={Math.max(0, Math.floor(data.length / 6) - 1)} />
          <ChartYAxis />
          <ChartTooltip />
          <ChartLegend />
          <ChartBar dataKey="delivered" name="Delivered" color="data.background.categorical.green.intense" stackId="webhooks" />
          <ChartBar dataKey="errors" name="Your server returned an error" color="data.background.categorical.red.intense" stackId="webhooks" />
          <ChartBar dataKey="off" name="Nothing sent, webhook off" color="data.background.categorical.gray.intense" stackId="webhooks" />
        </ChartBarWrapper>
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
