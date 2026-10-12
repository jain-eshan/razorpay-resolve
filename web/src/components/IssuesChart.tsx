import { useMemo, useState } from 'react'
import { Box, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartLegend, ChartTooltip, ChartXAxis, ChartYAxis, Text } from '@razorpay/blade/components'
import { rupees, type Schemas } from '../lib/api'
import { OWNER, kindName } from '../lib/format'
import { dayShort, istDay, rangeDays, type RangeId } from '../lib/range'
import { MenuPick } from './MenuPick'
import { Panel } from './Panel'

const SHOW = [{ id: 'value', label: 'Value' }, { id: 'volume', label: 'Volume' }] as const
const GROUP = [{ id: 'cause', label: 'Cause' }, { id: 'side', label: 'Whose side' }] as const
// One colour per group, in the order of the legend. Blade's categorical data colours, and not blue (which means an action on this page) or the orange of the "your side" badges beside the chart.
const PALETTE = ['purple', 'gold', 'skyBlue', 'pink', 'gray', 'orange'] as const

// Payment issues by the day they started, stacked, in a card of its own with its two controls in the header. "Show" is the amount involved or the number of
// customers; "Group by" is what it is stacked by. The axis ticks carry the unit (₹ or a count), so there is no rotated axis title.
// Every number is added up from the issue summaries the API already returns.
export function IssuesChart({ issues, range }: { issues: Schemas['IncidentSummary'][]; range: RangeId }) {
  const [show, setShow] = useState<(typeof SHOW)[number]['id']>('value')
  const [group, setGroup] = useState<(typeof GROUP)[number]['id']>('cause')
  const { data, names } = useMemo(() => {
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
    return { data, names }
  }, [issues, range, show, group])
  const money = show === 'value'

  return (
    <Panel title="Issues over time" trailing={
      <Box display="flex" flexWrap="wrap" gap="spacing.3">
        <MenuPick size="small" label="Show" value={show} options={SHOW} onPick={setShow} />
        <MenuPick size="small" label="Group by" value={group} options={GROUP} onPick={setGroup} />
      </Box>
    }>
      <Box testID="issues-chart">
        {names.length === 0 ? <Text size="small" color="surface.text.gray.muted">No payment issues started in this range.</Text> : (
          <Box height={{ base: '380px', l: '300px' }}>
            <ChartBarWrapper data={data} height="100%">
              <ChartCartesianGrid />
              <ChartXAxis dataKey="day" interval={Math.max(0, Math.ceil(data.length / 4) - 1)} />
              <ChartYAxis tickFormatter={(v: number) => (money ? lakh(v) : String(v))} />
              <ChartTooltip formatter={(v) => (money ? rupees(Number(v) * 100) : `${v} customers`)} />
              <ChartLegend />
              {names.map((n, i) => <ChartBar key={n} dataKey={n} name={n} stackId="issues" color={`data.background.categorical.${PALETTE[i % PALETTE.length]}.intense`} />)}
            </ChartBarWrapper>
          </Box>
        )}
      </Box>
    </Panel>
  )
}

// An axis tick in rupees, short: ₹56L (lakh) and ₹12k, as Indian merchants write it. Tooltips and cards show the full figure.
const lakh = (v: number) => (v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${+(v / 1e3).toFixed(1)}k` : `₹${v}`)
