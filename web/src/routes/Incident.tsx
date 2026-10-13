import { useRef, useState, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, AlertTriangleIcon, Badge, Box, Button, Card, CardBody, EmptyState, Heading,
  SegmentedControl, SegmentedControlItem, StepGroup, StepItem, StepItemIndicator, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TablePagination,
  TableRow, Text,
} from '@razorpay/blade/components'
import { Crumbs } from '../components/Crumbs'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { FixPanel } from '../components/FixPanel'
import { EvidenceLane } from '../components/EvidenceLane'
import { IncidentStats } from '../components/IncidentStats'
import { JustYou } from '../components/JustYou'
import { Lane } from '../components/Lane'
import { Panel } from '../components/Panel'
import { LiveStepIndicator } from '../components/Pulse'
import { RootCauseActions } from '../components/RootCauseActions'
import { StartFix } from '../components/StartFix'
import { StoryStrip } from '../components/StoryStrip'
import { TimelineChart } from '../components/TimelineChart'
import { rupees, useGet, type Schemas } from '../lib/api'
import { cause, headline, sentence, when } from '../lib/format'
import DuplicateView from './DuplicateView'
import RenewalView from './RenewalView'
import Zone1View from './Zone1View'
import { PageSkeleton } from '../components/PageSkeleton'
import { Mine } from '../components/Mine'
import { useAccount } from '../lib/account'
import BrandIssue from './BrandIssue'

// Restored is not one of the engine's tiers: the engine files a customer Resolve gave access back to as excluded, "restored by Resolve". A merchant reads
// "left out" as skipped, so restored customers get their own tab, and Left out keeps only the ones really left out (given access by hand, refunded).
const TIERS = ['exact', 'likely', 'check', 'restored', 'excluded'] as const
const TIER_LABEL = { exact: 'Certain', likely: 'Likely', check: 'By hand', restored: 'Restored', excluded: 'Left out' }
const RESTORED = 'restored by Resolve'
const inTier = (m: Schemas['Member'], t: (typeof TIERS)[number]) => t === 'restored' ? m.exclusion_reason === RESTORED : t === 'excluded' ? m.tier === 'excluded' && m.exclusion_reason !== RESTORED : m.tier === t
const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'neutral', bank: 'neutral', customer: 'neutral', unknown: 'neutral' } as const
const STATUS_TONE = { open: 'notice', fixing: 'information', verifying: 'information', closed: 'positive' } as const
const STATUS_LABEL = { open: 'Open', fixing: 'Fixing', verifying: 'Verifying', closed: 'Closed' }

// A value with a muted line under it. `plain` drops the bold, for long text that would make every row heavy.
const two = (top: string, bottom: string, plain = false) => (
  <Box display="flex" flexDirection="column"><Text weight={plain ? 'regular' : 'semibold'} color="surface.text.gray.subtle">{top}</Text><Text size="small" color="surface.text.gray.muted">{bottom}</Text></Box>
)

// One line that makes the counts add up: everyone found, who is still waiting, and who was left out and why.
const LEFT_OUT: Record<string, string> = { 'already active (manual grant)': 'already given access by hand', refunded: 'already refunded' }
function reconcile(inc: Schemas['IncidentDetail'], members: Schemas['Member'][]) {
  if (!members.length) return `${inc.affected} customers`
  const waiting = members.filter((m) => m.tier !== 'excluded' && m.merchant_state !== 'active').length
  const restored = members.filter((m) => m.exclusion_reason === RESTORED).length
  const reasons = Object.entries(members.filter((m) => m.tier === 'excluded' && m.exclusion_reason !== RESTORED).reduce<Record<string, number>>((a, m) => {
    const r = LEFT_OUT[m.exclusion_reason ?? ''] ?? m.exclusion_reason ?? 'other'
    return { ...a, [r]: (a[r] ?? 0) + 1 }
  }, {})).map(([r, n]) => `${n} ${r}`)
  return `${members.length} found · ${waiting} still without access${restored ? ` · ${restored} restored by Resolve` : ''}${reasons.length ? ` · left out: ${reasons.join(', ')}` : ''}`
}

// What happened, in order, in the dashboard's Timeline style. The last step is where the founder's fix lands; while it is still to do, its dot carries the live pulse.
function Milestones({ inc, pack, atAlert, fix }: { inc: Schemas['IncidentDetail']; pack?: Schemas['EvidencePack']; atAlert: number | null; fix: RefObject<HTMLDivElement> }) {
  const v = inc.verdict
  const off = inc.timeline.find((b) => b.markers.some((m) => m.startsWith("Razorpay's docs say it turns the webhook off")))
  const steps: { at?: string; title: string; text?: string; stamp?: string; tone: 'neutral' | 'negative' | 'information' | 'notice' | 'positive' }[] = [
    { at: v.onset_at, title: 'Your change went live', text: String(v.cause_summary_slots.change ?? ''), tone: 'neutral' as const },
    ...(pack?.first_failure_at ? [{ at: pack.first_failure_at, title: 'First failed delivery', text: `Your server answered ${v.signature.status ?? 'with an error'}`, tone: 'negative' as const }] : []),
    ...(inc.would_have_alerted_at ? [{ at: inc.would_have_alerted_at, title: 'Resolve would have alerted', text: `${atAlert ?? 1} customer affected by then`, tone: 'information' as const }] : []),
    ...(off ? [{ at: off.bucket_start, title: "Razorpay's docs say it turns the webhook off", text: 'After 24 hours of failures. In our own test the retries stopped and the webhook stayed switched on, so this step is documented, not observed', stamp: `Around ${when(off.bucket_start)}`, tone: 'notice' as const }] : []),
    ...(v.resolved_at ? [{ at: v.resolved_at, title: 'Your server answered again', tone: 'positive' as const }] : []),
  ].sort((a, b) => a.at!.localeCompare(b.at!))
  const done = inc.status === 'closed'
  return (
    <Card padding="spacing.7" testID="milestones">
      <CardBody>
      <Heading as="h2" size="medium">Timeline</Heading>
      <Box marginTop="spacing.5">
        <StepGroup size="medium">
          {[
            ...steps.map((s) => (
              <StepItem key={s.title} title={s.title} timestamp={s.stamp ?? when(s.at!)} description={s.text} stepProgress="full" marker={<StepItemIndicator color={s.tone} />} />
            )),
            <StepItem key="end" title={done ? 'Customers restored' : 'Customers still to restore'} stepProgress="none"
              description={done ? 'Every grant was checked against your records' : `${inc.tier_counts.exact ?? 0} customers paid and did not get access`} marker={done ? <StepItemIndicator color="positive" /> : <LiveStepIndicator color="notice" />} />,
          ]}
        </StepGroup>
      </Box>
      <StartFix to={fix} closed={done} variant="secondary" wideOnly />
      </CardBody>
    </Card>
  )
}

function Incident() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [version, setVersion] = useState(0)
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`, version)
  const { data: members } = useGet<Schemas['Member'][]>(`/api/incidents/${id}/members`, version)
  const { data: sample } = useGet<Schemas['SampleTimeline'][]>(`/api/incidents/${id}/sample`, version)
  const { data: pack, error: packError } = useGet<Schemas['EvidencePack']>(`/api/incidents/${id}/evidence_pack`)
  const [tier, setTier] = useState<(typeof TIERS)[number]>('exact')
  const fix = useRef<HTMLDivElement>(null)
  // An address for an issue that does not exist (a mistyped link, another demo): say so and give the way out, not a parser error.
  if (error) return (
    <EmptyState size="large" asset={<AlertTriangleIcon size="2xlarge" color="surface.icon.gray.muted" />} title="We could not find that payment issue" description={`${id} is not in this demo. It may have been mistyped, or it may be from another version.`}>
      <Button variant="primary" onClick={() => nav('/incidents')}>See all payment issues</Button>
    </EmptyState>
  )
  if (!inc || (!pack && !packError)) return <PageSkeleton />  // the page appears whole, so the cards in it do not grow as more of it arrives
  if (inc.zone === 'before') return <Zone1View id={id} />
  if (inc.mismatch_type === 'E') return <DuplicateView id={id} />   // customers charged twice: the webhook worked, only the second charge is wrong
  if (inc.mismatch_type === 'G') return <RenewalView id={id} />   // renewals that failed on Razorpay's side: no webhook to show
  const v = inc.verdict
  const count = (t: (typeof TIERS)[number]) => (members ?? []).filter((m) => inTier(m, t)).length
  // Once customers are restored and none is left to fix, open on Restored rather than an empty Certain tab.
  const shown = tier === 'exact' && count('exact') === 0 && count('restored') > 0 ? 'restored' : tier
  const rows = (members ?? []).filter((m) => inTier(m, shown)).map((m) => ({ ...m, id: m.payment_id }))
  const atAlert = inc.would_have_alerted_at && members ? members.filter((m) => m.captured_at <= inc.would_have_alerted_at!).length : null

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <Crumbs items={[{ label: 'Payment issues', to: '/incidents' }, { label: inc.id, to: `/incidents/${inc.id}` }]} />

      <Card padding="spacing.5">
        <CardBody>
        <Box display="flex" gap="spacing.5" alignItems="center" flexWrap="wrap">
          <Box width="56px" height="56px" borderRadius="medium" backgroundColor="feedback.background.notice.subtle" display="flex" alignItems="center" justifyContent="center">
            <AlertTriangleIcon size="xlarge" color="feedback.icon.notice.intense" />
          </Box>
          <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="240px">
            <Heading as="h1" size="medium">{headline(inc)}</Heading>
            <Text size="small" color="surface.text.gray.muted">{`Technical cause: ${inc.title}`}</Text>
            <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
              <Badge color={OWNER_TONE[inc.owner]} size="medium">{cause(inc)}</Badge>
              <Badge color={STATUS_TONE[inc.status]} size="medium">{STATUS_LABEL[inc.status]}</Badge>
              <Text size="small" color="surface.text.gray.muted">{sentence(v.confidence)} confidence · started {when(inc.onset_at)} · {inc.id}</Text>
            </Box>
          </Box>
        </Box>
        </CardBody>
      </Card>

      <StoryStrip inc={inc} members={members} />

      {/* The answer, in plain words, full width between the story and the numbers, as on the other issue pages. Slots are the engine's, not typed here. */}
      <Alert isFullWidth color="information" isDismissible={false} title="Your app never heard about these payments"
        description={`Since ${v.cause_summary_slots.change ? `your release ${String(v.cause_summary_slots.change).split(':')[0]} (${when(v.onset_at)})` : 'a change on your side'}, your server has answered Razorpay's payment messages with an error${v.signature.status ? ` (${v.signature.status})` : ''}. Customers were charged, but your app was never told, so it never gave them access.${inc.would_have_alerted_at && atAlert !== null ? ` With Resolve on, you would have known ${when(inc.would_have_alerted_at)}, when ${atAlert} customer was affected.` : ''}`} />

      <IncidentStats inc={inc} />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', l: 'minmax(0, 1fr) 320px' }} gap="spacing.6" alignItems="start">
        <Box display="flex" flexDirection="column" gap="spacing.6" minWidth="0px">


          <Panel title="What your server did" subtitle="Webhook outcomes, hour by hour">
            <TimelineChart buckets={inc.timeline} marks={[{ at: v.onset_at, label: 'Webhooks broke' }, { at: v.resolved_at, label: 'Webhooks fixed' }]} />
          </Panel>

          <EvidenceLane inc={inc} pack={pack} />
          <JustYou inc={inc} />
          <RootCauseActions inc={inc} pack={pack} fix={fix} closed={inc.status === 'closed'} />

          <Panel title="Can Razorpay replay these?" subtitle="Support can replay one event at a time">
            <Text>
              {inc.replay.replayable_by_support} yes, by a support ticket, one event at a time. {inc.replay.not_replayable_disabled_window} no, because they were sent while the webhook was off.
            </Text>
            <Text size="small" color="surface.text.gray.muted">{inc.replay.note}</Text>
          </Panel>

          <Panel title="Affected customers" subtitle={reconcile(inc, members ?? [])} pad={false}>
            <Box padding="spacing.5">
              <SegmentedControl label="How sure Resolve is" name="tier" value={shown} onChange={({ value }) => setTier(value as (typeof TIERS)[number])}>
                {TIERS.filter((t) => t !== 'restored' || count('restored') > 0).map((t) => <SegmentedControlItem key={t} value={t}>{TIER_LABEL[t]} ({count(t)})</SegmentedControlItem>)}
              </SegmentedControl>
            </Box>
            {rows.length === 0 ? (
              <Box padding="spacing.6"><Text color="surface.text.gray.muted">None in this group.</Text></Box>
            ) : (
              <Table data={{ nodes: rows }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(120px, 1.2fr) minmax(110px, 1.1fr) minmax(250px, 2.5fr) minmax(120px, 1.2fr)" isHeaderSticky={false}>
                {(items) => (
                  <>
                    <TableHeader>
                      <TableHeaderRow>
                        <TableHeaderCell>Payment</TableHeaderCell>
                        <TableHeaderCell>Amount</TableHeaderCell>
                        <TableHeaderCell>What happened</TableHeaderCell>
                        <TableHeaderCell>Your records</TableHeaderCell>
                      </TableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((m) => (
                        <TableRow key={m.payment_id} item={m}>
                          <TableCell>{two(m.customer_masked, m.payment_id)}</TableCell>
                          <TableCell>{two(rupees(m.amount_paise), m.plan)}</TableCell>
                          <TableCell>{two(m.delivery_outcome, `${when(m.captured_at)} · ${m.exclusion_reason ?? m.replay_eligibility.replaceAll('_', ' ')}`, true)}</TableCell>
                          <TableCell>
                            <Box display="flex" gap="spacing.2" flexWrap="wrap">
                              <Badge size="medium" color={m.merchant_state === 'active' ? 'positive' : 'negative'}>{sentence(m.merchant_state)}</Badge>
                              <Badge size="medium" color={m.complained ? 'notice' : 'neutral'}>{m.complained ? 'Complained' : 'Silent'}</Badge>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
            )}
          </Panel>

          {sample && sample.length > 0 && (
            <Panel title={`${sample.length} customers, side by side`} subtitle="What the customer said, what Razorpay recorded and what your records show. Check a few before you fix.">
              {sample.map((s) => {
                const m = members?.find((x) => x.payment_id === s.payment_id)
                return (
                <Box key={s.payment_id} display="flex" flexDirection="column" gap="spacing.3" paddingBottom="spacing.4" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                    <Text size="small" weight="semibold">{m ? `${m.customer_masked} · ${rupees(m.amount_paise)}` : s.payment_id}</Text>
                    {m && (m.exclusion_reason === RESTORED
                      ? <Badge size="small" color="positive">Restored by Resolve</Badge>
                      : <Badge size="small" color={m.tier === 'excluded' ? 'neutral' : 'notice'}>{m.tier === 'excluded' ? `Left out: ${LEFT_OUT[m.exclusion_reason ?? ''] ?? m.exclusion_reason}` : 'Still without access'}</Badge>)}
                    <Text size="small" color="surface.text.gray.muted">{s.payment_id}</Text>
                  </Box>
                  <Box display="flex" gap="spacing.5" flexWrap="wrap">
                    <Lane title="Customer says" items={s.lanes.customer} empty="Did not write in" />
                    <Lane title="Razorpay says" items={s.lanes.razorpay} />
                    <Lane title="Your records say" items={s.lanes.merchant} />
                  </Box>
                </Box>
                )
              })}
            </Panel>
          )}
          <Box ref={fix} testID="fix-steps"><FixPanel inc={inc} members={members ?? []} onChanged={() => setVersion((n) => n + 1)} /></Box>
          {/* Asking "was this a real problem?" under a verified fix sends a mixed message, so it goes once the issue is closed. */}
          {inc.status !== 'closed' && <FeedbackPanel incidentId={inc.id} />}

        </Box>

        <Box position={{ base: 'static', l: 'sticky' }} top="spacing.5">
          <Milestones inc={inc} pack={pack} atAlert={atAlert} fix={fix} />
        </Box>
      </Box>
    </Box>
  )
}

// A payment issue belongs to one account: FK-n are the brand account's (read from its files), INC-n are the engine's (Kaksha). Opened under the other account, the page says whose
// it is and offers the switch, instead of showing one merchant's issue inside the other's dashboard.
export default function IssuePage() {
  const { id = '' } = useParams()
  const me = useAccount()
  if (id.startsWith('FK-')) return <Mine only="flipkart"><BrandIssue id={id} /></Mine>
  if (me.kind === 'enterprise') return <Mine only="kaksha"><Incident /></Mine>
  return <Incident />
}
