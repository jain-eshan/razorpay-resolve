import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, ClockIcon, EmptyState, Heading, SegmentedControl, SegmentedControlItem, Table, TableBody,
  TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TablePagination, TableRow, Text, UsersIcon,
} from '@razorpay/blade/components'
import { AlertCard, PhoneScreen, SlackThread, type AlertPreview, type AppPreview, type SlackPreview } from '../components/BrandPreviews'
import { Crumbs } from '../components/Crumbs'
import { EvidenceLane, type Row } from '../components/EvidenceLane'
import { JustYou } from '../components/JustYou'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { StoryTiles, type StoryStep } from '../components/StoryStrip'
import { useAccount } from '../lib/account'
import { rupees, useGet, type Schemas } from '../lib/api'
import { approve, startAgain, useApproved } from '../lib/approvals'
import { OWNER, sentence } from '../lib/format'
import { clock } from '../lib/time'
import { useWidth } from '../lib/useWidth'

// One payment issue of the brand account, as `synth/brand_world.py` writes it. Words and figures are the file's; this page lays them out.
type Group = { id: string; label: string; count: number; amount_paise: number; hint: string; put_right: boolean }
type Action = { id: string; title: string; text: string; button: string; group?: string; needs?: string; done?: boolean; done_by?: string; told?: number }
type Customer = { payment_id: string; customer: string; at: string; amount_paise: number; upi_app: string; bank: string; region: string; group: string; what: string; note: string }
export type BrandIssueData = {
  id: string; kind: string; owner: Schemas['IncidentSummary']['owner']; status: 'open' | 'closed'; confidence: string; headline: string; cause: string; onset_at: string; resolved_at?: string
  heard: { via: string; value: string; note: string; at: string }; affected: number; complained: number; answer: { title: string; text: string }
  groups: Group[]; money_stuck_paise: number; money_note: string
  lane: { axis_from: string; axis_to: string; onset: string; rows: Row[] }
  lift: (Omit<Schemas['LiftRow'], 'lift'> & { lift: number | null })[]; compared: string; cannot_see: string[]
  root: { cause: string; fix: string; signals: string[]; samples: string[] }
  actions: Action[]; explained_minutes: number; closing: string
  previews: { app?: AppPreview; alert?: AlertPreview; slack?: SlackPreview }
  customers: Customer[]
}

const n = (x: number) => x.toLocaleString('en-IN')
const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'neutral', bank: 'neutral', customer: 'neutral', unknown: 'neutral' } as const
const two = (top: string, bottom: string) => (
  <Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{top}</Text><Text size="small" color="surface.text.gray.muted">{bottom}</Text></Box>
)
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box display="flex" flexDirection="column" gap="spacing.1">
    <Text size="small" weight="semibold" color="surface.text.gray.muted">{label}</Text>
    {children}
  </Box>
)

// Two cards side by side when each gets about 300px, stacked below that. Measured, so it is its own component: it mounts once the data is here (a measurement taken while the
// skeleton shows would find nothing to measure).
function Pair({ children, testID, min = 640 }: { children: ReactNode; testID: string; min?: number }) {
  const [grid, room] = useWidth<HTMLDivElement>()
  return <Box ref={grid} display="grid" gridTemplateColumns={room >= min ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'} gap="spacing.5" alignItems="stretch" testID={testID}>{children}</Box>
}

// A payment issue on the brand account (v3, two accounts): the same parts in the same order as every other issue page (DESIGN.md section 15, Detail page), plus where it showed
// up outside Razorpay (the customer's phone, the brand's alert tool, its Slack channel). Approvals are this tab's only (lib/approvals.ts): nothing is refunded or sent.
export default function BrandIssue({ id }: { id: string }) {
  const nav = useNavigate()
  const me = useAccount()
  const { data: d, error } = useGet<BrandIssueData>(`/api/incidents/${id}`)
  const approved = useApproved(id)
  const [tab, setTab] = useState<string>()
  const lift = useMemo(() => d?.lift.map((r) => ({ ...r, lift: r.lift ?? 0 })) ?? [], [d])
  if (error) return (
    <EmptyState size="large" asset={<AlertTriangleIcon size="2xlarge" color="surface.icon.gray.muted" />} title="We could not find that payment issue" description={`${id} is not in ${me.name}'s account.`}>
      <Button variant="primary" onClick={() => nav('/incidents')}>See all payment issues</Button>
    </EmptyState>
  )
  if (!d) return <PageSkeleton />

  const done = (a: Action) => !!a.done || approved.includes(a.id)
  const ready = (a: Action) => !done(a) && (!a.needs || done(d.actions.find((x) => x.id === a.needs)!))
  const closed = d.status === 'closed' || d.actions.every(done)
  // Put right: a group counts once the action that settles it is done (the message settles "no order", and it waits for the orders to be confirmed first).
  const fixed = d.groups.filter((g) => g.put_right || d.actions.some((a) => a.group === g.id && done(a))).reduce((s, g) => s + g.count, 0)
  // Told: the customers the message reached, which is its group, or its own count when it went only to those who wrote in.
  const told = d.actions.filter((a) => a.id === 'message' && done(a)).reduce((s, a) => s + (a.told ?? d.groups.find((g) => g.id === a.group)?.count ?? 0), 0)
  const steps: StoryStep[] = [
    { title: 'Hear', done: true, value: d.heard.value, note: d.heard.note },
    { title: 'Find everyone', done: true, value: `${n(d.affected)} customers hit`, note: d.groups.map((g) => `${n(g.count)} ${g.label.toLowerCase()}`).join(', ') },
    { title: 'Whose side', done: true, value: OWNER[d.owner], note: `${sentence(d.confidence)} confidence` },
    { title: 'Fix', done: fixed === d.affected, value: fixed === d.affected ? `All ${n(d.affected)} put right` : `${n(fixed)} of ${n(d.affected)} put right`, note: closed ? 'closed' : approved.length ? 'in progress' : 'needs your approval' },
    { title: 'Win back', done: told > 0, value: told > 0 ? `${n(told)} told` : 'No one told yet', note: told > 0 ? 'in your name' : 'needs your approval' },
  ]
  const next = d.actions.find(ready)?.id  // the one blue button: the first step still waiting that can go now
  const shown = tab ?? d.groups[0].id
  const rows = d.customers.filter((c) => c.group === shown).map((c) => ({ ...c, id: c.payment_id }))
  // One line per step that waits for approval, and one for closing: all there from the start, so the Slack preview keeps its size as approvals come in.
  const replies = d.status === 'closed' ? [] : [
    ...d.actions.map((a) => ({ text: `${a.title}: ${done(a) ? 'approved by you' : 'waiting for your approval'}`, done: done(a) })),
    // Both lines are about as long, so the line keeps its two-line room whichever it shows.
    { text: closed ? 'Closed. In this demo nothing was refunded or sent.' : 'Closes once you have approved every step above.', done: closed },
  ]

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <Crumbs items={[{ label: 'Payment issues', to: '/incidents' }, { label: d.id, to: `/incidents/${d.id}` }]} />

      <Card padding="spacing.5">
        <CardBody>
          <Box display="flex" gap="spacing.5" alignItems="center" flexWrap="wrap">
            <Box width="56px" height="56px" borderRadius="medium" backgroundColor={closed ? 'feedback.background.positive.subtle' : 'feedback.background.notice.subtle'} display="flex" alignItems="center" justifyContent="center">
              {closed ? <CheckCircleIcon size="xlarge" color="feedback.icon.positive.intense" /> : <AlertTriangleIcon size="xlarge" color="feedback.icon.notice.intense" />}
            </Box>
            <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="240px">
              <Heading as="h1" size="medium">{d.headline}</Heading>
              <Text size="small" color="surface.text.gray.muted">{`Cause: ${d.cause}`}</Text>
              <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                <Badge color={OWNER_TONE[d.owner]} size="medium">{OWNER[d.owner]}</Badge>
                <Badge color={closed ? 'positive' : 'notice'} size="medium">{closed ? 'Closed' : 'Open'}</Badge>
                <Text size="small" color="surface.text.gray.muted">{`${sentence(d.confidence)} confidence · started ${clock(d.onset_at)} · ${d.id}`}</Text>
              </Box>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <StoryTiles steps={steps} />

      {/* The answer stays put while approvals come in (the closing goes into the Slack preview and the story strip), so the page does not move under the buttons. An issue that was
          already closed shows how it was closed. */}
      <Box testID="brand-answer">
        {d.status === 'closed'
          ? <Alert isFullWidth color="positive" isDismissible={false} title="Closed: every customer is put right" description={d.closing} />
          : <Alert isFullWidth color="information" isDismissible={false} title={d.answer.title} description={d.answer.text} />}
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5" testID="brand-stats">
        <Stat label="Customers hit" value={n(d.affected)} hint={d.money_stuck_paise ? `${rupees(d.money_stuck_paise)} ${d.money_note}` : d.money_note} icon={AlertTriangleIcon} tone={closed ? 'neutral' : 'notice'} />
        {d.groups.map((g) => <Stat key={g.id} label={g.label} value={n(g.count)} hint={g.hint} icon={UsersIcon} />)}
        {d.groups.length < 2 && <Stat label="Time to root cause" value={`${d.explained_minutes} min`} hint={d.heard.via === 'Razorpay' ? 'from the start, posted by Razorpay' : 'from the release, with proof'} icon={ClockIcon} />}
      </Box>

      {(d.previews.app || d.previews.alert || d.previews.slack) && (
        <Panel title="Where it showed up" subtitle="Outside Razorpay: what your customers and your tools saw. Previews, not the apps themselves" testID="where-it-showed-up">
          {(d.previews.app || d.previews.alert) && (
            <Pair testID="previews-top" min={600}>
              {d.previews.app && <PhoneScreen p={d.previews.app} count={d.affected} />}
              {d.previews.alert && <AlertCard a={d.previews.alert} />}
            </Pair>
          )}
          {d.previews.slack && <SlackThread s={d.previews.slack} replies={replies} />}
        </Panel>
      )}

      <EvidenceLane rows={d.lane.rows} onset={d.lane.onset} axis={{ from: d.lane.axis_from, to: d.lane.axis_to }} />
      <JustYou inc={{ lift, verdict: { what_we_cannot_see: d.cannot_see } }} compared={d.compared} />

      <Pair testID="root-cause-actions">
        <Panel title="Root cause" fill>
          <Field label="Cause"><Text>{d.root.cause}</Text></Field>
          <Field label="The fix"><Text>{d.root.fix}</Text></Field>
          <Field label="Whose side">
            <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap">
              <Badge size="medium" color={OWNER_TONE[d.owner]}>{OWNER[d.owner]}</Badge>
              <Text size="small" color="surface.text.gray.muted">{`${sentence(d.confidence)} confidence, ${d.root.signals.length} signals agree`}</Text>
            </Box>
            <Box display="flex" flexDirection="column" paddingTop="spacing.2">
              {d.root.signals.map((s) => <Text key={s} size="small" color="surface.text.gray.muted">{s}</Text>)}
            </Box>
          </Field>
          <Field label="Sample payments"><Text size="small" color="surface.text.gray.muted">{d.root.samples.join(', ')}</Text></Field>
        </Panel>
        <Panel title={d.status === 'closed' ? 'What was done' : 'Actions that need your approval'} fill>
          {d.actions.map((a) => (
            <Box key={a.id} display="flex" flexDirection="column" gap="spacing.2" testID={`action-${a.id}`}>
              <Text weight="semibold">{a.title}</Text>
              <Text size="small" color="surface.text.gray.muted">{a.text}</Text>
              {/* The approved badge sits in a row as tall as a medium button, so approving does not move what is below it. */}
              <Box display="flex" alignItems="center" minHeight="36px">
                {done(a)
                  ? <Badge color="positive" size="large" icon={CheckCircleIcon}>{a.done ? `Done by ${a.done_by ?? 'you'}` : 'Approved by you'}</Badge>
                  : <Button variant={a.id === next ? 'primary' : 'secondary'} size="medium" isFullWidth isDisabled={!ready(a)} onClick={() => approve(d.id, a.id)}>{a.button}</Button>}
              </Box>
            </Box>
          ))}
          {d.status === 'open' && (
            <Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing.3" flexWrap="wrap" marginTop="auto">
              <Text size="small" color="surface.text.gray.muted">Demo: approving changes this page only. No refund is made and no message is sent.</Text>
              {/* Always there, so the card does not grow on the first approval; it has nothing to undo until then. */}
              <Button variant="tertiary" size="medium" isDisabled={approved.length === 0} onClick={() => startAgain(d.id)}>Start again</Button>
            </Box>
          )}
        </Panel>
      </Pair>

      <Panel title="Affected customers" subtitle={`${n(d.affected)} found · ${n(fixed)} put right`} pad={false}>
        {d.groups.length > 1 && (
          <Box padding="spacing.5">
            <SegmentedControl label="What happened to them" name="group" value={shown} onChange={({ value }) => setTab(value)}>
              {d.groups.map((g) => <SegmentedControlItem key={g.id} value={g.id}>{`${g.label} (${n(g.count)})`}</SegmentedControlItem>)}
            </SegmentedControl>
          </Box>
        )}
        <Table data={{ nodes: rows }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(150px, 1.4fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(240px, 2.2fr)" isHeaderSticky={false}>
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
                    <TableCell>{two(x.what, x.note)}</TableCell>
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
