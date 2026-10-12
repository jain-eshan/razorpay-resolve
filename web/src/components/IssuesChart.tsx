import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartLegend, ChartTooltip, ChartXAxis, ChartYAxis, CheckCircleIcon, EmptyState, Heading, SegmentedControl, SegmentedControlItem, Skeleton, Text } from '@razorpay/blade/components'
import { rupees, type Schemas } from '../lib/api'
import { OWNER, kindName } from '../lib/format'
import { dayShort, inRange, istDay, RANGES, rangeDays, type RangeId } from '../lib/range'
import { MenuPick } from './MenuPick'
import { Panel } from './Panel'

const HORIZONS = RANGES.filter((r) => r.id !== 'today')  // a chart by day has nothing to show for one day
const SHOW = [{ id: 'value', label: 'Value' }, { id: 'volume', label: 'Volume' }] as const
const GROUP = [{ id: 'cause', label: 'Cause' }, { id: 'side', label: 'Whose side' }] as const
const SHORT: Record<string, string> = { '7d': '7 days', '30d': '30 days', month: 'Month' }
// One colour per group, in the order of the legend. Blade's categorical data colours, and not blue (which means an action on this page) or the orange of the
// "your side" badges beside the chart.
const PALETTE = ['purple', 'gold', 'skyBlue', 'pink', 'gray', 'orange'] as const
const PLOT = 220  // the plot's height, always. Nothing here changes size when the data does.
const LEGEND_ROW = 44  // what one row of Blade's legend takes

// Payment issues by the day they started, stacked, in a card of its own. The card says what the bars add up to, and has three controls: the time horizon (it starts at
// the page's range and can be changed here without moving the rest of the page), "Show" (the amount involved or the number of customers) and "Group by" (what the bars are
// stacked by). Every number is added up from the issue summaries the API already returns.
// It never changes size because of its data: the plot has a fixed height, the legend has room for every group that exists (not only the ones in this range, so colours
// stay put as well), and a range with nothing in it shows its empty state in the same space. Only what is inside the plot changes. Until the plot has been drawn a skeleton of
// the same size stands in, so nothing grows when it appears.
export function IssuesChart({ issues: all, range: pageRange }: { issues: Schemas['IncidentSummary'][]; range: RangeId }) {
  const [range, setRange] = useState<RangeId>(pageRange === 'today' ? '7d' : pageRange)
  const [show, setShow] = useState<(typeof SHOW)[number]['id']>('value')
  const [group, setGroup] = useState<(typeof GROUP)[number]['id']>('cause')
  const money = show === 'value'
  // The legend wraps by the card's own width (the card is half the page, so a window width says nothing about it): measure the card before the first paint and reserve
  // the rows its width needs.
  const body = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    setWidth(Math.round(el.getBoundingClientRect().width))
    const watch = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { const f = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(f) }, [])

  const name = (i: Schemas['IncidentSummary']) => (group === 'cause' ? kindName(i.mismatch_type) : OWNER[i.owner])
  const amount = (i: Schemas['IncidentSummary']) => (money ? i.at_risk_paise / 100 : i.affected)
  // Every group there is, biggest first over all the data, so the legend and the colours do not move when the range does.
  const names = useMemo(() => {
    const totals = new Map<string, number>()
    all.forEach((i) => totals.set(name(i), (totals.get(name(i)) ?? 0) + amount(i)))
    return [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, group, show])
  const { data, total, count } = useMemo(() => {
    const issues = all.filter((i) => inRange(i.onset_at, range))
    const data = rangeDays(range).map((d) => {
      const row: Record<string, string | number> = { day: dayShort(d), ...Object.fromEntries(names.map((n) => [n, 0])) }
      issues.filter((i) => istDay(new Date(i.onset_at)) === d).forEach((i) => { row[name(i)] = (row[name(i)] as number) + amount(i) })
      return row
    })
    return { data, total: issues.reduce((a, i) => a + amount(i), 0), count: issues.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, range, names, show, group])
  const rangeLabel = RANGES.find((r) => r.id === range)!.label.toLowerCase()
  const rows = Math.ceil(names.length / Math.max(1, Math.floor(width / 200)))
  const legendHeight = rows * LEGEND_ROW
  const narrow = width < 400

  return (
    <Panel title="Issues over time" fill trailing={
      // No wrapping inside the control: at 375px "30 days" broke onto two lines.
      <Box whiteSpace="nowrap">
        <SegmentedControl size="small" accessibilityLabel="Time horizon" value={range} onChange={({ value }) => setRange(value as RangeId)}>
          {HORIZONS.map((r) => <SegmentedControlItem key={r.id} value={r.id}>{SHORT[r.id]}</SegmentedControlItem>)}
        </SegmentedControl>
      </Box>
    }>
      <Box ref={body} display="flex" flexDirection="column" gap="spacing.5" testID="issues-chart">
        <Box display="flex" flexWrap="wrap" alignItems="flex-start" justifyContent="space-between" gap="spacing.4">
          {/* What the bars add up to, so the card can be read without hovering. */}
          <Box display="flex" flexDirection="column" minHeight="spacing.10">
            <Heading as="h3" size="large">{count === 0 ? 'All clear' : money ? rupees(total * 100) : `${total} customers`}</Heading>
            <Text size="small" color="surface.text.gray.muted">{count === 0 ? `no payment issues started ${rangeLabel}` : `${count} payment issue${count === 1 ? '' : 's'} started ${rangeLabel}`}</Text>
          </Box>
          <Box display="flex" flexWrap="wrap" gap="spacing.3">
            <MenuPick size="small" label="Show" value={show} options={SHOW} onPick={setShow} isDisabled={count === 0} />
            <MenuPick size="small" label="Group by" value={group} options={GROUP} onPick={setGroup} isDisabled={count === 0} />
          </Box>
        </Box>
        {/* The one part that changes: same height whether it holds the plot, its skeleton or the empty state. */}
        <Box height={`${PLOT + legendHeight}px`}>
          {!drawn || width === 0 ? (
            <Skeleton width="100%" height="100%" borderRadius="medium" />
          ) : count === 0 ? (
            <Box height="100%" display="flex" alignItems="center" justifyContent="center">
              <EmptyState size="small" asset={<CheckCircleIcon size="2xlarge" color="feedback.icon.positive.intense" />} title="No payment issues" description={`None started ${rangeLabel}. Blindspot checks every 15 minutes.`} />
            </Box>
          ) : (
            <ChartBarWrapper data={data} height="100%">
              <ChartCartesianGrid />
              <ChartXAxis dataKey="day" interval={Math.max(0, Math.ceil(data.length / (narrow ? 4 : 6)) - 1)} />
              <ChartYAxis tickFormatter={(v: number) => (money ? lakh(v) : String(v))} />
              <ChartTooltip formatter={(v) => (money ? rupees(Number(v) * 100) : `${v} customers`)} />
              <ChartLegend layout="horizontal" verticalAlign="bottom" height={legendHeight} />
              {names.map((n, i) => <ChartBar key={n} dataKey={n} name={n} stackId="issues" color={`data.background.categorical.${PALETTE[i % PALETTE.length]}.intense`} />)}
            </ChartBarWrapper>
          )}
        </Box>
      </Box>
    </Panel>
  )
}

// An axis tick in rupees, short: ₹56L (lakh) and ₹12k, as Indian merchants write it. Tooltips and the heading show the full figure.
const lakh = (v: number) => (v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${+(v / 1e3).toFixed(1)}k` : `₹${v}`)
