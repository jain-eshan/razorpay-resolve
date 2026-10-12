import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartReferenceLine, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { bucketAt, droppedMarks, thinLabels, yTop, hourLabel } from '../lib/format'
import type { Schemas } from '../lib/api'
import { ChartKey } from './ChartKey'
import { useNarrow } from '../lib/useNarrow'

// One bar per hour, stacked. Green: delivered. Red: your server answered with an error. Grey: nothing was sent because the webhook was off.
// `marks` are moments to draw a line at (the change going live, the server answering again). Hover a bar to read the hour and each count.
// The hours with something to say are listed under the chart. The chart has a fixed height, so it does not move while it draws.
export function TimelineChart({ buckets, marks = [] }: { buckets: Schemas['TimelineBucket'][]; marks?: { at: string | null | undefined; label: string }[] }) {
  const narrow = useNarrow()
  const marked = buckets.filter((b) => b.markers.length)
  const data = buckets.map((b) => ({ hour: hourLabel(b.bucket_start), delivered: b.ok, errors: b.client_error + b.server_error, off: b.not_attempted }))
  const lines = thinLabels(marks.map((m) => ({ x: bucketAt(buckets.map((b) => b.bucket_start), m.at, hourLabel), label: m.label })).filter((m): m is { x: string; label: string } => !!m.x), data.map((d) => d.hour))
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box height="280px" testID="timeline-chart">
        <ChartBarWrapper data={data} height="100%">
          <ChartCartesianGrid />
          <ChartXAxis dataKey="hour" interval={Math.max(0, narrow ? Math.ceil(data.length / 3) - 1 : Math.floor(data.length / 6) - 1)} />
          <ChartYAxis label="Webhooks per hour" tickCount={4} allowDecimals={false} domain={[0, (max: number) => yTop(max)]} />
          <ChartTooltip />
          <ChartBar dataKey="delivered" name="Delivered" color="data.background.categorical.green.intense" stackId="webhooks" />
          <ChartBar dataKey="errors" name="Your server returned an error" color="data.background.categorical.red.intense" stackId="webhooks" />
          <ChartBar dataKey="off" name="Nothing sent" color="data.background.categorical.gray.intense" stackId="webhooks" />
          {lines.map((m) => <ChartReferenceLine key={m.x} x={m.x} label={m.label} />)}
        </ChartBarWrapper>
      </Box>
      <ChartKey items={[{ name: 'Delivered', color: 'green' }, { name: 'Your server returned an error', color: 'red' }, { name: 'Nothing sent', color: 'gray' }]} notes={droppedMarks(lines)} />
      <Box display="flex" flexDirection="column" gap="spacing.2">
        {marked.map((b) => (
          <Text key={b.bucket_start} size="small">
            {hourLabel(b.bucket_start)} · {b.markers.join(' · ').replace('change point · alert would fire at', 'Blindspot would have alerted at')}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
