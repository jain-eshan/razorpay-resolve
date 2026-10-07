import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, AlertTriangleIcon, Badge, BellOffIcon, Box, Button, Card, CardBody, CheckCircleIcon, Heading, MessageCircleIcon,
  SegmentedControl, SegmentedControlItem, StepGroup, StepItem, StepItemIndicator, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TablePagination,
  TableRow, Text,
} from '@razorpay/blade/components'
import { Crumbs } from '../components/Crumbs'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { FixPanel } from '../components/FixPanel'
import { Lane } from '../components/Lane'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { TimelineChart } from '../components/TimelineChart'
import { rupees, useGet, type Schemas } from '../lib/api'
import { OWNER, sentence, when } from '../lib/format'
import RenewalView from './RenewalView'
import Zone1View from './Zone1View'

const TIERS = ['exact', 'likely', 'check', 'excluded'] as const
const TIER_LABEL = { exact: 'Exact', likely: 'Likely', check: 'Check manually', excluded: 'Excluded' }
const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'negative', bank: 'information', customer: 'neutral', unknown: 'neutral' } as const
const STATUS_TONE = { open: 'notice', fixing: 'information', verifying: 'information', closed: 'positive' } as const
const STATUS_LABEL = { open: 'Open', fixing: 'Fixing', verifying: 'Verifying', closed: 'Closed' }

const two = (top: string, bottom: string) => (
  <Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{top}</Text><Text size="small" color="surface.text.gray.muted">{bottom}</Text></Box>
)

// What happened, in order, in the dashboard's Timeline style. The last step is where the founder's fix lands.
function Milestones({ inc, pack, atAlert }: { inc: Schemas['IncidentDetail']; pack?: Schemas['EvidencePack']; atAlert: number | null }) {
  const v = inc.verdict
  const off = inc.timeline.find((b) => b.markers.some((m) => m.startsWith('Razorpay turns the webhook off')))
  const steps: { at?: string; title: string; text?: string; stamp?: string; tone: 'neutral' | 'negative' | 'information' | 'notice' | 'positive' }[] = [
    { at: v.onset_at, title: 'Your change went live', text: String(v.cause_summary_slots.change ?? ''), tone: 'neutral' as const },
    ...(pack?.first_failure_at ? [{ at: pack.first_failure_at, title: 'First failed delivery', text: `Your server answered ${v.signature.status ?? 'with an error'}`, tone: 'negative' as const }] : []),
    ...(inc.would_have_alerted_at ? [{ at: inc.would_have_alerted_at, title: 'You could have known', text: `${atAlert ?? 1} customer affected`, tone: 'information' as const }] : []),
    ...(off ? [{ at: off.bucket_start, title: 'Razorpay turned the webhook off', text: 'After 24 hours of failures', stamp: `Around ${when(off.bucket_start)}`, tone: 'notice' as const }] : []),
    ...(v.resolved_at ? [{ at: v.resolved_at, title: 'Your server answered again', tone: 'positive' as const }] : []),
  ].sort((a, b) => a.at!.localeCompare(b.at!))
  const done = inc.status === 'closed'
  return (
    <Card padding="spacing.7">
      <CardBody>
      <Heading size="medium">Timeline</Heading>
      <Box marginTop="spacing.5">
        <StepGroup size="medium">
          {[
            ...steps.map((s) => (
              <StepItem key={s.title} title={s.title} timestamp={s.stamp ?? when(s.at!)} description={s.text} stepProgress="full" marker={<StepItemIndicator color={s.tone} />} />
            )),
            <StepItem key="end" title={done ? 'Customers restored' : 'Customers still to restore'} stepProgress="none"
              description={done ? 'Every grant was checked against your records' : `${inc.tier_counts.exact ?? 0} customers paid and have no access`} marker={<StepItemIndicator color={done ? 'positive' : 'notice'} />} />,
          ]}
        </StepGroup>
      </Box>
      </CardBody>
    </Card>
  )
}

export default function Incident() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [version, setVersion] = useState(0)
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`, version)
  const { data: members } = useGet<Schemas['Member'][]>(`/api/incidents/${id}/members`, version)
  const { data: sample } = useGet<Schemas['SampleTimeline'][]>(`/api/incidents/${id}/sample`, version)
  const { data: pack } = useGet<Schemas['EvidencePack']>(`/api/incidents/${id}/evidence_pack`)
  const [tier, setTier] = useState<(typeof TIERS)[number]>('exact')
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!inc) return <Text color="surface.text.gray.muted">Loading</Text>
  if (inc.zone === 'before') return <Zone1View id={id} />
  if (inc.mismatch_type === 'G') return <RenewalView id={id} />   // renewals that failed on Razorpay's side: no webhook to show
  const v = inc.verdict
  const rows = (members ?? []).filter((m) => m.tier === tier).map((m) => ({ ...m, id: m.payment_id }))
  const atAlert = inc.would_have_alerted_at && members ? members.filter((m) => m.captured_at <= inc.would_have_alerted_at!).length : null

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <Crumbs items={[{ label: 'Incidents', to: '/incidents' }, { label: inc.id, to: `/incidents/${inc.id}` }]} />

      <Card padding="spacing.5">
        <CardBody>
        <Box display="flex" gap="spacing.5" alignItems="center" flexWrap="wrap">
          <Box width="56px" height="56px" borderRadius="medium" backgroundColor="feedback.background.notice.subtle" display="flex" alignItems="center" justifyContent="center">
            <AlertTriangleIcon size="xlarge" color="feedback.icon.notice.intense" />
          </Box>
          <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="240px">
            <Heading size="medium">{inc.title}</Heading>
            <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
              <Badge color={OWNER_TONE[inc.owner]} size="medium">{`${inc.inferred ? 'Inferred. ' : ''}${OWNER[inc.owner]}`}</Badge>
              <Badge color={STATUS_TONE[inc.status]} size="medium">{STATUS_LABEL[inc.status]}</Badge>
              <Text size="small" color="surface.text.gray.muted">Confidence {v.confidence} · started {when(inc.onset_at)} · {inc.id}</Text>
            </Box>
          </Box>
          <Button variant="secondary" size="small" onClick={() => nav(`/incidents/${inc.id}/dev`)}>Send to your developer</Button>
        </Box>
        </CardBody>
      </Card>

      <Box display="grid" gridTemplateColumns={{ base: 'repeat(2, minmax(0, 1fr))', m: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
        <Box gridColumn="1 / -1">
          <Stat label="Affected" value={String(inc.affected)} hint={`customers paid and have no access · ${rupees(inc.at_risk_paise)} at risk`} icon={AlertTriangleIcon} tone="notice" />
        </Box>
        <Stat label="Complained" value={String(inc.complained)} icon={MessageCircleIcon} />
        <Stat label="Silent" value={String(inc.silent)} hint="never complained" icon={BellOffIcon} />
        <Box gridColumn={{ base: '1 / -1', m: 'auto' }}>
          <Stat label="Already fixed" value={String(inc.fixed)} hint="by hand, before this" icon={CheckCircleIcon} tone="positive" />
        </Box>
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: '1fr', l: 'minmax(0, 1fr) 320px' }} gap="spacing.6" alignItems="start">
        <Box display="flex" flexDirection="column" gap="spacing.6" minWidth="0px">
          {inc.would_have_alerted_at && atAlert !== null && (
            <Alert isFullWidth color="information" isDismissible={false} title="With this on" description={`You would have known ${when(inc.would_have_alerted_at)}, when ${atAlert} customer was affected. The first complaint came days later.`} />
          )}

          <Panel title="What your server did" subtitle="Webhook outcomes, hour by hour">
            <TimelineChart buckets={inc.timeline} />
          </Panel>

          <Panel title="Evidence" subtitle="What the failed payments have in common">
            <Box display="flex" flexDirection="column">
              {inc.lift.map((l) => (
                <Box key={l.dimension + l.value} display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" gap={{ base: 'spacing.1', m: 'spacing.5' }} paddingY="spacing.3" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Text>{sentence(l.dimension)}: {l.value.replace(/\bupi\b/g, 'UPI')}</Text>
                  <Text color="surface.text.gray.muted">{Math.round(l.share_affected * 100)}% of affected vs {(l.share_baseline * 100).toFixed(1)}% normally</Text>
                </Box>
              ))}
            </Box>
            {v.what_we_cannot_see.map((s) => <Text key={s} size="small" color="surface.text.gray.muted">We cannot see: {s}</Text>)}
          </Panel>

          <Panel title="Can Razorpay replay these?" subtitle="Support can replay one event at a time">
            <Text>
              {inc.replay.replayable_by_support} yes, by a support ticket, one event at a time. {inc.replay.not_replayable_disabled_window} no, because they were sent while the webhook was off.
            </Text>
            <Text size="small" color="surface.text.gray.muted">{inc.replay.note}</Text>
          </Panel>

          <Panel title="Affected customers" pad={false}
            trailing={<Text size="small" color="surface.text.gray.muted">{members?.length ?? 0} customers in this incident</Text>}>
            <Box padding="spacing.5">
              <SegmentedControl label="Confidence group" name="tier" value={tier} onChange={({ value }) => setTier(value as (typeof TIERS)[number])}>
                {TIERS.map((t) => <SegmentedControlItem key={t} value={t}>{TIER_LABEL[t]} ({inc.tier_counts[t] ?? 0})</SegmentedControlItem>)}
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
                          <TableCell>{two(m.delivery_outcome, `${when(m.captured_at)} · ${m.exclusion_reason ?? m.replay_eligibility.replaceAll('_', ' ')}`)}</TableCell>
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
            <Panel title={`Look at ${sample.length} before acting`} subtitle="Customer, Razorpay and your records, side by side">
              {sample.map((s) => (
                <Box key={s.payment_id} display="flex" flexDirection="column" gap="spacing.3" paddingBottom="spacing.4" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Text size="small" color="surface.text.gray.muted">{s.payment_id}</Text>
                  <Box display="flex" gap="spacing.5" flexWrap="wrap">
                    <Lane title="Customer says" items={s.lanes.customer} />
                    <Lane title="Razorpay says" items={s.lanes.razorpay} />
                    <Lane title="Your records say" items={s.lanes.merchant} />
                  </Box>
                </Box>
              ))}
            </Panel>
          )}
          <FixPanel inc={inc} members={members ?? []} onChanged={() => setVersion((n) => n + 1)} />
          <FeedbackPanel incidentId={inc.id} />

        </Box>

        <Box position={{ base: 'static', l: 'sticky' }} top="spacing.5">
          <Milestones inc={inc} pack={pack} atAlert={atAlert} />
        </Box>
      </Box>
    </Box>
  )
}
