import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartReferenceLine, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { chartMarks, markerText, yTop, dayLabel } from '../lib/format'
import type { Schemas } from '../lib/api'
import { ChartKey } from './ChartKey'
import { useNarrow } from '../lib/useNarrow'

// One bar per day of the Android version's orders, stacked. Green: orders that were fine. Red: the second order of a double tap.
// `marks` are moments to draw a line at (the release). Hover a bar to read the day and each count. The days with something to say are listed under the chart.
export function DuplicateChart({ buckets, marks = [] }: { buckets: Schemas['TimelineBucket'][]; marks?: { at: string | null | undefined; label: string }[] }) {
  const narrow = useNarrow()
  const marked = buckets.filter((b) => b.markers.length)
  const data = buckets.map((b) => ({ day: dayLabel(b.bucket_start), fine: b.ok, doubled: b.server_error }))
  const lines = chartMarks(buckets.map((b) => b.bucket_start), marks, dayLabel)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box height="280px" testID="duplicate-chart">
        <ChartBarWrapper data={data} height="100%">
          <ChartCartesianGrid />
          <ChartXAxis dataKey="day" interval={Math.max(0, Math.ceil(data.length / (narrow ? 3 : 5)) - 1)} />
          <ChartYAxis label="Orders per day" tickCount={4} allowDecimals={false} domain={[0, (max: number) => yTop(max)]} />
          <ChartTooltip />
          <ChartBar dataKey="fine" name="Orders that were fine" color="data.background.categorical.green.intense" stackId="orders" />
          <ChartBar dataKey="doubled" name="Second order of a double tap" color="data.background.categorical.red.intense" stackId="orders" />
          {lines.drawn.map((m) => <ChartReferenceLine key={m.x} x={m.x} label={m.label} />)}
        </ChartBarWrapper>
      </Box>
      <ChartKey items={[{ name: 'Orders that were fine', color: 'green' }, { name: 'Second order of a double tap', color: 'red' }]} notes={lines.dropped} />
      <Box display="flex" flexDirection="column" gap="spacing.2">
        {marked.map((b) => (
          <Text key={b.bucket_start} size="small">
            {dayLabel(b.bucket_start)} · {markerText(b.markers)}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
