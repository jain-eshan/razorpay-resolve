import { useMemo, useState } from 'react'
import {
  Alert, AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, Heading, RupeesIcon, SegmentedControl, SegmentedControlItem, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableHeaderRow, TablePagination, TableRow, Text, UsersIcon,
} from '@razorpay/blade/components'
import { Crumbs } from '../components/Crumbs'
import { DemoPath } from '../components/DemoPath'
import { EvidenceLane, type Row } from '../components/EvidenceLane'
import { JustYou } from '../components/JustYou'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { StoryTiles, type StoryStep } from '../components/StoryStrip'
import { rupees } from '../lib/api'
import { approve, BRAND, canApprove, clock, minutesBetween, STEPS, useApproved, useJ2, type J2Customer } from '../lib/brand'
import { n, two } from '../lib/brandBits'
import { Field, Pair } from '../components/BrandBits'

// J6 (roadmap batch 1.3): the big brand's payment issue, built from the same parts as every other issue page (story strip, three numbers, evidence lane, "Is it just you?", root
// cause and actions) but fed from the brand's own data (`web/public/brand/j2.json`). It sits inside the Razorpay dashboard, because this is where Razorpay's support engineer and
// the brand's payments team open the evidence. The approvals are this tab's only (lib/brand.ts): the Slack thread shows the same ones.
export default function BrandIssue() {
  const { data: j2, error } = useJ2()
  const done = useApproved()
  const [kind, setKind] = useState<J2Customer['outcome']>('paid_twice')
  const rows = useMemo<Row[] | undefined>(() => j2 && [
    { name: `${BRAND} app`, items: [{ at: j2.timeline.rollout, label: `${j2.app_version} rollout`, tone: 'neutral' }, { at: j2.timeline.rollback, label: 'rolled back', tone: 'positive' }] },
    { name: `${BRAND} server`, items: [{ at: j2.timeline.verify_stops, to: j2.timeline.rollback, label: 'no verify-payment calls', tone: 'negative' }] },
    { name: 'Razorpay', items: [{ at: j2.timeline.axis_from, to: j2.timeline.axis_to, label: 'captured normally', tone: 'positive' }] },
    { name: 'Sentry', items: [{ at: j2.timeline.errors_start, to: j2.timeline.rollback, label: `errors, alert at ${clock(j2.timeline.alert)}`, tone: 'notice' }] },
    { name: 'Blindspot', items: [{ at: j2.timeline.signoff, label: 'RCA signed off', tone: 'information' }] },
  ], [j2])
  const lift = useMemo(() => j2?.lift.map((r) => ({ ...r, lift: r.lift ?? 0 })) ?? [], [j2])
  if (error) return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <DemoPath at={3} guide="Loading the demo data" />
      <Alert isFullWidth color="negative" isDismissible={false} title="The demo data did not load" description={`${error}. Reload the page. If it keeps failing, run "uv run python -m synth.j2_brand" and reload.`} />
    </Box>
  )
  if (!j2 || !rows) return <PageSkeleton />

  const { counts: c, money_paise: m, timeline: t } = j2
  const closed = STEPS.every((s) => done.includes(s))
  const fixed = (done.includes('refund') ? c.paid_twice : 0) + (done.includes('message') ? c.no_order : 0)
  const told = done.includes('message') ? c.no_order : 0
  const steps: StoryStep[] = [
    { title: 'Hear', done: true, value: 'Alert from Sentry', note: `${clock(t.alert)}, sent to Razorpay` },
    { title: 'Find everyone', done: true, value: `${n(c.affected)} customers hit`, note: `${c.paid_twice} paid twice, ${c.no_order} no order` },
    { title: 'Whose side', done: true, value: 'Your code', note: 'Exact confidence' },
    { title: 'Fix', done: fixed === c.affected, value: `${n(fixed)} of ${n(c.affected)} put right`, note: closed ? 'closed' : done.length ? 'in progress' : 'needs your approval' },
    { title: 'Win back', done: told > 0, value: told > 0 ? `${n(told)} told` : 'No one told yet', note: told > 0 ? 'order confirmed' : 'needs your approval' },
  ]
  const actions = [
    { id: 'refund', title: `Refund ${c.paid_twice} duplicate payments`, text: `${rupees(m.paid_twice)} goes back to each customer's original payment method.`, button: `Refund ${c.paid_twice} duplicates` },
    { id: 'orders', title: `Send ${BRAND} ${c.no_order} paid orders`, text: `${rupees(m.no_order)} was paid with no order. The list has payment IDs, amounts and times, for ${BRAND} to confirm.`, button: `Send ${c.no_order} order list` },
    { id: 'message', title: `Message ${c.no_order} customers`, text: `Tells them their payment went through and their order is confirmed, in ${BRAND}'s name. It waits until the orders are confirmed.`, button: `Message ${c.no_order} customers` },
  ] as const
  const next = actions.find((a) => canApprove(a.id, done))?.id  // the one blue button: the first step still waiting that can go now
  const shown = j2.customers.filter((x) => x.outcome === kind).map((x) => ({ ...x, id: x.payment_id }))
  const count = (o: J2Customer['outcome']) => (o === 'paid_twice' ? c.paid_twice : c.no_order)

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <DemoPath at={3} primary={closed} guide={`The same facts as the Slack thread, with the evidence behind them. Approve here or there: ${BRAND} sees one set of approvals.`} />
      <Crumbs items={[{ label: 'Payment issues', to: '/demo/issues' }, { label: `${BRAND} app ${j2.app_version}`, to: '/demo/incident' }]} />

      <Card padding="spacing.5">
        <CardBody>
          <Box display="flex" gap="spacing.5" alignItems="center" flexWrap="wrap">
            <Box width="56px" height="56px" borderRadius="medium" backgroundColor="feedback.background.notice.subtle" display="flex" alignItems="center" justifyContent="center">
              <AlertTriangleIcon size="xlarge" color="feedback.icon.notice.intense" />
            </Box>
            <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="240px">
              <Heading as="h1" size="medium">{`${n(c.affected)} customers paid by UPI and saw “Payment failed”`}</Heading>
              <Text size="small" color="surface.text.gray.muted">{`Cause: ${j2.platform} app ${j2.app_version} skips the verify-payment call after UPI`}</Text>
              <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                <Badge color="notice" size="medium">Your code</Badge>
                <Badge color={closed ? 'positive' : 'notice'} size="medium">{closed ? 'Closed' : 'Open'}</Badge>
                <Text size="small" color="surface.text.gray.muted">{`Exact confidence · started ${clock(t.rollout)} · demo issue`}</Text>
              </Box>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <StoryTiles steps={steps} />

      {closed ? (
        <Alert isFullWidth color="positive" isDismissible={false} title="Closed: every customer is put right"
          description={`The fault was explained ${minutesBetween(t.alert, t.rca)} minutes after the alert and signed off at ${clock(t.signoff)}. The cause was ${BRAND}'s app, not Razorpay or a bank. In this demo nothing was refunded or sent.`} />
      ) : (
        <Alert isFullWidth color="information" isDismissible={false} title={`${BRAND}'s app never told its server about these payments`}
          description={`Since app ${j2.app_version} went live at ${clock(t.rollout)}, the app shows “Payment failed” after UPI payments that Razorpay captured. ${BRAND}'s server was never asked to verify them, so no order was confirmed. Razorpay and the banks were working normally.`} />
      )}

      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5" testID="brand-stats">
        <Stat label="Customers hit" value={n(c.affected)} hint={`${rupees(m.stuck)} paid, no order confirmed`} icon={AlertTriangleIcon} tone="notice" />
        <Stat label="Paid twice" value={n(c.paid_twice)} hint={`${rupees(m.paid_twice)} to refund`} icon={UsersIcon} />
        <Stat label="Left with no order" value={n(c.no_order)} hint={`${rupees(m.no_order)} paid`} icon={RupeesIcon} />
      </Box>

      <EvidenceLane rows={rows} onset={t.rollout} axis={{ from: t.axis_from, to: t.axis_to }} />
      <JustYou inc={{ lift, verdict: { what_we_cannot_see: ['customers who paid another way, such as cash on delivery or another gateway'] } }} compared={`Compared with ${BRAND}'s payments in the ${j2.baseline_minutes} minutes before the release`} />

      <Pair>
        <Panel title="Root cause" fill>
          <Field label="Cause"><Text>{`App ${j2.app_version} skips the verify-payment call after UPI, so orders stay unconfirmed and the app shows “Payment failed”.`}</Text></Field>
          <Field label="The fix"><Text>{`Roll back ${j2.app_version}, or patch the verify-payment call.`}</Text></Field>
          <Field label="Whose side">
            <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap">
              <Badge size="medium" color="notice">Your code</Badge>
              <Text size="small" color="surface.text.gray.muted">{`Exact confidence, ${j2.signals.length} signals agree`}</Text>
            </Box>
            <Box display="flex" flexDirection="column" paddingTop="spacing.2">
              {j2.signals.map((s) => <Text key={s} size="small" color="surface.text.gray.muted">{s}</Text>)}
            </Box>
          </Field>
          <Field label="Sample payments"><Text size="small" color="surface.text.gray.muted">{j2.sample_payment_ids.slice(0, 3).join(', ')}</Text></Field>
        </Panel>
        <Panel title="Actions, need your approval" fill>
          {actions.map((a) => (
            <Box key={a.id} display="flex" flexDirection="column" gap="spacing.2" testID={`action-${a.id}`}>
              <Text weight="semibold">{a.title}</Text>
              <Text size="small" color="surface.text.gray.muted">{a.text}</Text>
              {done.includes(a.id)
                ? <Box display="flex" alignItems="center" minHeight="36px"><Badge color="positive" size="large" icon={CheckCircleIcon}>Approved by you</Badge></Box>
                : <Button variant={a.id === next ? 'primary' : 'secondary'} size="medium" isFullWidth isDisabled={!canApprove(a.id, done)} onClick={() => approve(a.id)}>{a.button}</Button>}
            </Box>
          ))}
          <Text size="small" color="surface.text.gray.muted" marginTop="auto">Demo: approving changes this screen and the Slack thread only. No refund is made and no message is sent.</Text>
        </Panel>
      </Pair>

      <Panel title="Affected customers" subtitle={`${n(c.affected)} found · ${n(fixed)} put right`} pad={false}>
        <Box padding="spacing.5">
          <SegmentedControl label="What happened to them" name="outcome" value={kind} onChange={({ value }) => setKind(value as J2Customer['outcome'])}>
            <SegmentedControlItem value="paid_twice">{`Paid twice (${count('paid_twice')})`}</SegmentedControlItem>
            <SegmentedControlItem value="no_order">{`No order (${count('no_order')})`}</SegmentedControlItem>
          </SegmentedControl>
        </Box>
        <Table data={{ nodes: shown }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(150px, 1.4fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(240px, 2.2fr)" isHeaderSticky={false}>
          {(items) => (
            <>
              <TableHeader>
                <TableHeaderRow>
                  <TableHeaderCell>Customer</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Paid at</TableHeaderCell>
                  <TableHeaderCell>What happened</TableHeaderCell>
                </TableHeaderRow>
              </TableHeader>
              <TableBody>
                {items.map((x) => (
                  <TableRow key={x.payment_id} item={x}>
                    <TableCell>{two(x.customer, x.payment_id)}</TableCell>
                    <TableCell>{two(rupees(x.amount_paise), `${x.upi_app} · ${x.bank}`)}</TableCell>
                    <TableCell>{two(clock(x.at), x.region)}</TableCell>
                    <TableCell>{two(x.outcome === 'paid_twice' ? 'Paid again, and that one got an order' : 'Paid, and no order was made', x.outcome === 'paid_twice' ? `This payment is the duplicate; second payment ${clock(x.second_at!)}` : 'Needs its order confirmed')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}
        </Table>
      </Panel>
    </Box>
  )
}
