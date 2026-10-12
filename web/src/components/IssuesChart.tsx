import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartLegend, ChartTooltip, ChartXAxis, ChartYAxis, Heading, Text } from '@razorpay/blade/components'
import { rupees, type Schemas } from '../lib/api'
import { OWNER, kindName } from '../lib/format'
import { dayShort, inRange, istDay, RANGES, rangeDays, type RangeId } from '../lib/range'
import { MenuPick } from './MenuPick'
import { Panel } from './Panel'

const SHOW = [{ id: 'value', label: 'Value' }, { id: 'volume', label: 'Volume' }] as const
const GROUP = [{ id: 'cause', label: 'Cause' }, { id: 'side', label: 'Whose side' }] as const
// One colour per group, in the order of the legend. Blade's categorical data colours, and not blue (which means an action on this page) or the orange of the
// "your side" badges beside the chart.
const PALETTE = ['purple', 'gold', 'skyBlue', 'pink', 'gray', 'orange'] as const

// Payment issues by the day they started, stacked, in a card of its own. The card says what the bars add up to, and has three controls: the time horizon
// (it starts at the page's range and can be changed here without moving the rest of the page), "Show" (the amount involved or the number of customers) and
// "Group by" (what the bars are stacked by). Every number is added up from the issue summaries the API already returns.
// The axis ticks carry the unit (₹ or a count), so there is no rotated axis title.
export function IssuesChart({ issues: all, range: pageRange }: { issues: Schemas['IncidentSummary'][]; range: RangeId }) {
  const [range, setRange] = useState<RangeId>(pageRange)
  const [show, setShow] = useState<(typeof SHOW)[number]['id']>('value')
  const [group, setGroup] = useState<(typeof GROUP)[number]['id']>('cause')
  // The legend wraps by the card's own width (it is half the page, so a window width says nothing about it): measure the card and reserve the rows it needs.
  const body = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = body.current
    if (!el) return
    const watch = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const money = show === 'value'
  const { data, names, total, count } = useMemo(() => {
    const issues = all.filter((i) => inRange(i.onset_at, range))
    const name = (i: Schemas['IncidentSummary']) => (group === 'cause' ? kindName(i.mismatch_type) : OWNER[i.owner])
    const amount = (i: Schemas['IncidentSummary']) => (show === 'value' ? i.at_risk_paise / 100 : i.affected)
    const totals = new Map<string, number>()
    issues.forEach((i) => totals.set(name(i), (totals.get(name(i)) ?? 0) + amount(i)))
    const names = [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)!)
    const data = rangeDays(range).map((d) => {
      const row: Record<string, string | number> = { day: dayShort(d), ...Object.fromEntries(names.map((n) => [n, 0])) }
      issues.filter((i) => istDay(new Date(i.onset_at)) === d).forEach((i) => { row[name(i)] = (row[name(i)] as number) + amount(i) })
      return row
    })
    return { data, names, total: [...totals.values()].reduce((a, b) => a + b, 0), count: issues.length }
  }, [all, range, show, group])
  const rangeLabel = RANGES.find((r) => r.id === range)!.label.toLowerCase()
  // The legend gets its own reserved height, 44px a row (what Blade's legend takes), about 200px an item. Without it the chart lets a wrapped legend run over
  // the axis labels or out of the card.
  const rows = Math.ceil(names.length / Math.max(1, Math.floor(width / 200)))
  const legendHeight = rows * 44
  const narrow = width < 400

  return (
    <Panel title="Issues over time">
      <Box ref={body} display="flex" flexDirection="column" gap="spacing.5" testID="issues-chart">
        <Box display="flex" flexWrap="wrap" alignItems="flex-start" justifyContent="space-between" gap="spacing.4">
          {/* What the bars add up to, so the card can be read without hovering. */}
          <Box display="flex" flexDirection="column">
            <Heading as="h3" size="large">{money ? rupees(total * 100) : `${total} customers`}</Heading>
            <Text size="small" color="surface.text.gray.muted">{count ? `across ${count} payment issue${count === 1 ? '' : 's'} that started ${rangeLabel}` : `no payment issues started ${rangeLabel}`}</Text>
          </Box>
          <Box display="flex" flexWrap="wrap" gap="spacing.3">
            <MenuPick size="small" value={range} options={RANGES} onPick={setRange} />
            <MenuPick size="small" label="Show" value={show} options={SHOW} onPick={setShow} />
            <MenuPick size="small" label="Group by" value={group} options={GROUP} onPick={setGroup} />
          </Box>
        </Box>
        {names.length > 0 && (
          <Box height={`${220 + legendHeight}px`}>
            <ChartBarWrapper data={data} height="100%">
              <ChartCartesianGrid />
              <ChartXAxis dataKey="day" interval={Math.max(0, Math.ceil(data.length / (narrow ? 4 : 6)) - 1)} />
              <ChartYAxis tickFormatter={(v: number) => (money ? lakh(v) : String(v))} />
              <ChartTooltip formatter={(v) => (money ? rupees(Number(v) * 100) : `${v} customers`)} />
              <ChartLegend layout="horizontal" verticalAlign="bottom" height={legendHeight} />
              {names.map((n, i) => <ChartBar key={n} dataKey={n} name={n} stackId="issues" color={`data.background.categorical.${PALETTE[i % PALETTE.length]}.intense`} />)}
            </ChartBarWrapper>
          </Box>
        )}
      </Box>
    </Panel>
  )
}

// An axis tick in rupees, short: ₹56L (lakh) and ₹12k, as Indian merchants write it. Tooltips and the heading show the full figure.
const lakh = (v: number) => (v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${+(v / 1e3).toFixed(1)}k` : `₹${v}`)
