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

const COLUMNS = 'minmax(170px, 1.6fr) minmax(190px, 1.8fr) minmax(210px, 2fr) minmax(100px, 0.9fr) minmax(190px, 1.6fr)'

function RowsTable({ rows, third }: { rows: Row[]; third: (r: Row) => { top: string; sub: string } }) {
  return (
    <Table data={{ nodes: rows.map((r) => ({ ...r, id: r.payment_id })) }} gridTemplateColumns={COLUMNS} isHeaderSticky={false}>
      {(items) => (
        <>
          <TableHeader>
            <TableHeaderRow>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Grace period</TableHeaderCell>
              <TableHeaderCell>Renewal failed</TableHeaderCell>
              <TableHeaderCell>Unpaid</TableHeaderCell>
              <TableHeaderCell>Access ends on its own</TableHeaderCell>
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

// The engine calls the merchant's grace period a "rule" and an unpaid renewal a "leak". The page says it in the merchant's words, so its sentences are reworded here,
// the way headline() rewords an issue title.
const plain = (t: string) => t
  .replace(/your (\d+) hour rule/gi, (_, h: string) => `your ${h} hour grace period`)
  .replace(/when your rule ran out\. That is the rule working\./, 'when their grace period ended. That is your grace period working.')
  .replace('Those rows are not leaks.', 'Those customers are not a problem.')
  .replace('It reads the payments it has been given.', 'Blindspot sees only the attempts made so far.')

// J6, "Unpaid renewals". UPI renewals that failed on the customer's side while access stayed on past the merchant's own rule. A report: nothing here changes anything.
// It is its own page, not a payment issue (Batch 1.5 T6): a payment issue is an event (something broke, it has a cause and a fix, then it closes) and the customer
// lost out. This is a balance that grows every day: the payment failed as it should, the customer kept access, so the merchant is the one losing money, and what to
// do about it (end access, or send a payment link) is the merchant's business call, which Blindspot never makes.
export default function Leakage() {
  const { data, error } = useGet<Schemas['LeakageReport']>('/api/leakage')
  if (!data && !error) return <PageSkeleton />
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader guide="access" title="Unpaid renewals" description="Not a payment issue: nothing broke. The renewal failed because the customer's account had no money, but they kept access, so you are the one losing money." />
      {error && <Text color="feedback.text.negative.intense">Could not load unpaid renewals: {error}. Reload the page, and if it keeps failing check that the API is running.</Text>}
      {data && (
        <>
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
            <Stat label="Owed to you" value={rupees(data.owed_paise)} hint={`from ${plural(data.rows.length, 'failed renewal')}, as of ${when(data.as_of)}`} icon={AlertTriangleIcon} tone={data.customers ? 'notice' : 'positive'} />
            <Stat label="Kept access" value={String(data.customers)} hint={`customers past your ${data.grace_hours} hour grace period`} icon={UnlockIcon} tone={data.customers ? 'notice' : 'positive'} />
            <Stat label="Longest past it" value={data.customers ? span(data.longest_over_hours) : 'None'} hint={data.customers ? 'and it grows every day' : `your grace period is ${data.grace_hours} hours`} icon={ClockIcon} />
          </Box>
          <Alert isFullWidth isDismissible={false} color="information" title="Blindspot never takes access away" description="What to do is your call: end access in your own system, or send the customer your own payment link." />

          <Panel title={data.customers ? `${plural(data.customers, 'customer')} past your grace period` : 'Nobody is past their grace period'}
            subtitle={data.customers ? 'Longest past it first. Access ends on its own at the end of the period they did not pay for, unless you end it sooner.' : 'Every failed renewal was paid again or had access ended in time.'} pad={false}>
            {data.rows.length > 0 && <RowsTable rows={data.rows} third={(r) => ({ top: `Ended ${when(r.rule_ends_at)}`, sub: `${span(r.hours_over_rule)} ago` })} />}
          </Panel>

          {data.inside_rule.length > 0 && (
            <Panel title={`${data.inside_rule.length} more are still inside their grace period`} subtitle="Not yet a problem. Each one joins the list above when their grace period ends." pad={false}>
              <RowsTable rows={data.inside_rule} third={(r) => ({ top: `Ends ${when(r.rule_ends_at)}`, sub: `in ${span(-r.hours_over_rule)}` })} />
            </Panel>
          )}

          <Panel title="How Blindspot checked" subtitle="Each step keeps only the customers who still fit">
            <Box display="flex" flexDirection="column" gap="spacing.3">
              {data.funnel.map((s) => (
                <Box key={s.label} display="flex" justifyContent="space-between" gap="spacing.4"><Text>{plain(s.label)}</Text><Text weight="semibold">{String(s.count)}</Text></Box>
              ))}
            </Box>
            {data.left_out.length > 0 && (
              <Box display="flex" flexDirection="column" gap="spacing.2" paddingTop="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle">
                <Text size="small" weight="semibold" color="surface.text.gray.subtle">Left out, and why</Text>
                {data.left_out.map((l) => <Box key={l.label} display="flex" gap="spacing.3" alignItems="flex-start"><CheckCircleIcon size="small" color="surface.icon.gray.muted" /><Text size="small">{plain(l.label)}</Text></Box>)}
              </Box>
            )}
            <Box display="flex" flexDirection="column" gap="spacing.2" paddingTop="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle">
              <Text size="small" weight="semibold" color="surface.text.gray.subtle">What Blindspot cannot see</Text>
              {data.cannot_see.map((c) => <Text key={c} size="small" color="surface.text.gray.muted">{plain(c)}</Text>)}
            </Box>
          </Panel>
        </>
      )}
    </Box>
  )
}
