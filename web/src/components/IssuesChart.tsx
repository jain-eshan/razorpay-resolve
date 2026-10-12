import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartTooltip, ChartXAxis, ChartYAxis, CheckCircleIcon, EmptyState, Heading, SegmentedControl, SegmentedControlItem, Skeleton, Text } from '@razorpay/blade/components'
import { rupees, type Schemas } from '../lib/api'
import { OWNER, kindName } from '../lib/format'
import { dayShort, inRange, istDay, RANGES, rangeDays, type RangeId } from '../lib/range'
import { ChartKey } from './ChartKey'
import { MenuPick } from './MenuPick'
import { Panel } from './Panel'

const HORIZONS = RANGES.filter((r) => r.id !== 'today')  // a chart by day has nothing to show for one day
const SHOW = [{ id: 'value', label: 'Value' }, { id: 'volume', label: 'Volume' }] as const
const GROUP = [{ id: 'cause', label: 'Cause' }, { id: 'side', label: 'Whose side' }] as const
const SHORT: Record<string, string> = { '7d': '7 days', '30d': '30 days', month: 'Month' }
// One colour per group, in the order of the legend. Blade's categorical data colours, and not blue (which means an action on this page) or the orange of the
// "your side" badges beside the chart.
const PALETTE = ['purple', 'gold', 'skyBlue', 'pink', 'gray', 'orange'] as const
const PLOT = 240  // the plot's height, always. Nothing here changes size when the data does.
const LEGEND_ROW = 20  // one line of legend text (12px text), and the gap between lines
const LEGEND_GAP = 4
// How many lines a legend needs in a card this wide: names packed left to right, each about 6.2px a letter plus its swatch and gap. An estimate, made the same way every time
// so the room reserved never depends on anything but the card's width.
const legendRows = (names: string[], width: number) => {
  let rows = 1, used = 0
  for (const n of names) {
    const w = n.length * 6.2 + 8 + 4 + 12
    if (used + w > width && used > 0) { rows += 1; used = 0 }
    used += w
  }
  return rows
}

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
  // Room for the longest legend either grouping can have, so switching "Group by" never changes the card's height.
  const rows = Math.max(...GROUP.map((g) => legendRows([...new Set(all.map((i) => (g.id === 'cause' ? kindName(i.mismatch_type) : OWNER[i.owner])))], width)))
  const legendHeight = rows * LEGEND_ROW + (rows - 1) * LEGEND_GAP
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
        <Box height={`${PLOT + LEGEND_GAP * 4 + legendHeight}px`}>
          {!drawn || width === 0 ? (
            <Skeleton width="100%" height="100%" borderRadius="medium" />
          ) : count === 0 ? (
            <Box height="100%" display="flex" alignItems="center" justifyContent="center">
              <EmptyState size="small" asset={<CheckCircleIcon size="2xlarge" color="feedback.icon.positive.intense" />} title="No payment issues" description={`None started ${rangeLabel}. Blindspot checks every 15 minutes.`} />
            </Box>
          ) : (
            <Box height="100%" display="flex" flexDirection="column" gap="spacing.4">
              <Box height={`${PLOT}px`}>
                <ChartBarWrapper data={data} height="100%">
                  <ChartCartesianGrid />
                  <ChartXAxis dataKey="day" interval={Math.max(0, Math.ceil(data.length / (narrow ? 4 : 6)) - 1)} />
                  <ChartYAxis tickFormatter={(v: number) => (money ? lakh(v) : String(v))} />
                  <ChartTooltip formatter={(v) => (money ? rupees(Number(v) * 100) : `${v} customers`)} />
                  {names.map((n, i) => <ChartBar key={n} dataKey={n} name={n} stackId="issues" color={`data.background.categorical.${PALETTE[i % PALETTE.length]}.intense`} />)}
                </ChartBarWrapper>
              </Box>
              <ChartKey items={names.map((n, i) => ({ name: n, color: PALETTE[i % PALETTE.length] }))} />
            </Box>
          )}
        </Box>
      </Box>
    </Panel>
  )
}

// An axis tick in rupees, short: ₹56L (lakh) and ₹12k, as Indian merchants write it. Tooltips and the heading show the full figure.
const lakh = (v: number) => (v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${+(v / 1e3).toFixed(1)}k` : `₹${v}`)
