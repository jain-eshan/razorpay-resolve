import { Alert, Box, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text, AlertTriangleIcon, CheckCircleIcon, ClockIcon, UnlockIcon } from '@razorpay/blade/components'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { rupees, useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'

type Row = Schemas['LeakageRow']

// Hours the way a person says them: "30 hours", then "9 days 20 hours" once it is more than two days. Round first, then split, so it never reads "6 days 24 hours".
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const span = (h: number) => {
  const t = Math.round(h)
  if (t < 48) return plural(t, 'hour')
  return t % 24 === 0 ? plural(t / 24, 'day') : `${plural(Math.floor(t / 24), 'day')} ${plural(t % 24, 'hour')}`
}

const COLUMNS = 'minmax(170px, 1.6fr) minmax(190px, 1.8fr) minmax(210px, 2fr) minmax(100px, 0.9fr) minmax(150px, 1.4fr)'

function RowsTable({ rows, third }: { rows: Row[]; third: (r: Row) => { top: string; sub: string } }) {
  return (
    <Table data={{ nodes: rows.map((r) => ({ ...r, id: r.payment_id })) }} gridTemplateColumns={COLUMNS} isHeaderSticky={false}>
      {(items) => (
        <>
          <TableHeader>
            <TableHeaderRow>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Your rule</TableHeaderCell>
              <TableHeaderCell>Renewal failed</TableHeaderCell>
              <TableHeaderCell>Unpaid</TableHeaderCell>
              <TableHeaderCell>Access runs to</TableHeaderCell>
            </TableHeaderRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} item={r}>
                <TableCell><Box display="flex" flexDirection="column"><Text>{r.customer_masked}</Text><Text size="small" color="surface.text.gray.muted">{r.plan}</Text></Box></TableCell>
                <TableCell><Box display="flex" flexDirection="column"><Text>{third(r).top}</Text><Text size="small" color="surface.text.gray.muted">{third(r).sub}</Text></Box></TableCell>
                <TableCell><Box display="flex" flexDirection="column"><Text>{when(r.failed_at)}</Text><Text size="small" color="surface.text.gray.muted">{r.reason}</Text></Box></TableCell>
                <TableCell><Text>{rupees(r.amount_paise)}</Text></TableCell>
                <TableCell><Text>{when(r.access_until)}</Text></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </>
      )}
    </Table>
  )
}

// J6. UPI renewals that failed on the customer's side while access stayed on past the merchant's own rule. A report: nothing here changes anything.
export default function Leakage() {
  const { data, error } = useGet<Schemas['LeakageReport']>('/api/leakage')
  if (!data && !error) return <PageSkeleton />
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="Access without payment" description="Customers whose UPI renewal failed and who still have access after your own grace rule. Nothing here has been changed." />
      {error && <Text color="feedback.text.negative.intense">Could not load the report: {error}. Reload the page, and if it keeps failing check that the API is running.</Text>}
      {data && (
        <>
          <Alert isFullWidth isDismissible={false} color="information" title="A report, not an action" description="Blindspot never takes access away. To act, cut access in your own system, or send the customer your own payment link." />
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
            <Stat label="Customers past your rule" value={String(data.customers)} hint={`still have access, as of ${when(data.as_of)}`} icon={UnlockIcon} tone={data.customers ? 'notice' : 'positive'} />
            <Stat label="Renewals unpaid" value={rupees(data.owed_paise)} hint="the failed renewals, added up" icon={AlertTriangleIcon} tone={data.customers ? 'notice' : 'positive'} />
            <Stat label="Longest over your rule" value={data.customers ? span(data.longest_over_hours) : 'None'} hint={`your rule is ${data.grace_hours} hours`} icon={ClockIcon} />
          </Box>

          <Panel title={data.headline} pad={false}>
            {data.rows.length > 0 && <RowsTable rows={data.rows} third={(r) => ({ top: `Ended ${when(r.rule_ends_at)}`, sub: `${span(r.hours_over_rule)} ago` })} />}
          </Panel>

          {data.inside_rule.length > 0 && (
            <Panel title={`${data.inside_rule.length} more are inside your rule`} subtitle="Not yet a problem. Each one joins the report when its rule runs out." pad={false}>
              <RowsTable rows={data.inside_rule} third={(r) => ({ top: `Ends ${when(r.rule_ends_at)}`, sub: `in ${span(-r.hours_over_rule)}` })} />
            </Panel>
          )}

          <Panel title="How I checked" subtitle="Each step keeps only the customers who still fit">
            <Box display="flex" flexDirection="column" gap="spacing.3">
              {data.funnel.map((s) => (
                <Box key={s.label} display="flex" justifyContent="space-between" gap="spacing.4"><Text>{s.label}</Text><Text weight="semibold">{String(s.count)}</Text></Box>
              ))}
            </Box>
            {data.left_out.length > 0 && (
              <Box display="flex" flexDirection="column" gap="spacing.2" paddingTop="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle">
                <Text size="small" weight="semibold" color="surface.text.gray.subtle">Left out, and why</Text>
                {data.left_out.map((l) => <Box key={l.label} display="flex" gap="spacing.3" alignItems="flex-start"><CheckCircleIcon size="small" color="surface.icon.gray.muted" /><Text size="small">{l.label}</Text></Box>)}
              </Box>
            )}
            <Box display="flex" flexDirection="column" gap="spacing.2" paddingTop="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle">
              <Text size="small" weight="semibold" color="surface.text.gray.subtle">What I cannot see</Text>
              {data.cannot_see.map((c) => <Text key={c} size="small" color="surface.text.gray.muted">{c}</Text>)}
            </Box>
          </Panel>
        </>
      )}
    </Box>
  )
}
