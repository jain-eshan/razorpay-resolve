import { Box, ChartCartesianGrid, ChartLine, ChartLineWrapper, ChartReferenceLine, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { bucketAt, droppedMarks, thinLabels, yTop, hourLabel } from '../lib/format'
import { ChartKey } from './ChartKey'
import { useNarrow } from '../lib/useNarrow'

export type Hour = { at: string; orders: number; expected: number; zero_attempts: number; probe_checks: number; probe_failed: number; wrote_in: number }

// Orders by hour as three lines. Green: orders that arrived. Grey dashed: how many are normal for that hour, so a dip reads as a gap between the two.
// Red: orders nobody tried to pay for. Hover a point to read the hour and each count. The hours with something to say are listed under the chart,
// and so is how many hours the pay page failed its checks. `edges` are moments to draw a line at (when it started, and when it was fixed, if it was).
// The normal line is the engine's estimate for each hour, a single number and not a range, so there is no shaded band: drawing one would make up a range.
export function OrdersChart({ hours, marks, edges = [] }: { hours: Hour[]; marks: Record<string, string[]>; edges?: { at: string | null | undefined; label: string }[] }) {
  const narrow = useNarrow()
  const marked = hours.filter((h) => marks[h.at]?.length)
  const failing = hours.filter((h) => h.probe_failed > 0).length
  const data = hours.map((h) => ({ hour: hourLabel(h.at), arrived: h.orders, normal: Math.round(h.expected * 10) / 10, untried: h.zero_attempts }))
  const lines = thinLabels(edges.map((m) => ({ x: bucketAt(hours.map((h) => h.at), m.at, hourLabel), label: m.label })).filter((m): m is { x: string; label: string } => !!m.x), data.map((d) => d.hour))
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box height="280px" testID="orders-chart">
        <ChartLineWrapper data={data} height="100%">
          <ChartCartesianGrid />
          <ChartXAxis dataKey="hour" interval={Math.max(0, Math.ceil(hours.length / (narrow ? 3 : 5)) - 1)} />
          <ChartYAxis label="Orders per hour" tickCount={4} allowDecimals={false} domain={[0, (max: number) => yTop(max)]} />
          <ChartTooltip />
          <ChartLine type="linear" dataKey="arrived" name="Orders that arrived" color="data.background.categorical.green.intense" />
          <ChartLine type="linear" dataKey="normal" name="Normal for that hour" color="data.background.categorical.gray.intense" strokeStyle="dashed" />
          <ChartLine type="linear" dataKey="untried" name="Orders nobody tried to pay for" color="data.background.categorical.red.intense" />
          {lines.map((m) => <ChartReferenceLine key={m.x} x={m.x} label={m.label} />)}
        </ChartLineWrapper>
      </Box>
      <ChartKey items={[{ name: 'Orders that arrived', color: 'green' }, { name: 'Normal for that hour', color: 'gray' }, { name: 'Orders nobody tried to pay for', color: 'red' }]} notes={droppedMarks(lines)} />
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Text size="small" color="surface.text.gray.muted">{`Orders by hour over ${hours.length} hours. ` + (failing ? `The pay page failed its checks in ${failing} of them.` : 'The pay page passed its checks in every hour.')}</Text>
        {marked.map((h) => (
          <Text key={h.at} size="small">{hourLabel(h.at)} · {marks[h.at].join(' · ')}</Text>
        ))}
      </Box>
    </Box>
  )
}
