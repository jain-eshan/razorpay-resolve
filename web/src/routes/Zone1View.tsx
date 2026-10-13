import { useRef, useState } from 'react'
import {
  Alert, AlertTriangleIcon, Badge, Box, Card, CardBody, Heading, StepGroup, StepItem, StepItemIndicator, Table, TableBody,
  TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TablePagination, TableRow, Text,
} from '@razorpay/blade/components'
import { LiveStepIndicator } from '../components/Pulse'
import { Crumbs } from '../components/Crumbs'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { OrdersChart, type Hour } from '../components/OrdersChart'
import { Panel } from '../components/Panel'
import { EvidenceLane } from '../components/EvidenceLane'
import { IncidentStats } from '../components/IncidentStats'
import { JustYou } from '../components/JustYou'
import { RootCauseActions } from '../components/RootCauseActions'
import { StartFix } from '../components/StartFix'
import { StoryStrip } from '../components/StoryStrip'
import { Zone1Fix } from '../components/Zone1Fix'
import { rupees, useGet, type Schemas } from '../lib/api'
import { CHANNEL, cause, headline, sentence, when } from '../lib/format'
import { PageSkeleton } from '../components/PageSkeleton'

type Sig = { kind: 'probe' | 'gap' | 'complaints'; hourly: Hour[]; normal_zero_share?: number; alert_at?: string; end?: string | null; event_at?: string | null }
const STATUS_TONE = { open: 'notice', fixing: 'information', verifying: 'information', closed: 'positive' } as const
const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'negative', bank: 'information', customer: 'neutral', unknown: 'neutral' } as const
const LABEL: Record<string, string> = { probe_failure: 'Your pay page failed its checks', order_attempt_gap: 'Orders nobody tried to pay for', order_volume_dip: 'Fewer orders than normal',
  complaint_spike: 'Customers wrote in that they could not pay', merchant_event: 'A change on your side just before' }

const two = (top: string, bottom: string) => (
  <Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{top}</Text><Text size="small" color="surface.text.gray.muted">{bottom}</Text></Box>
)

// What each piece of evidence says, in a sentence, from the numbers the engine saved with the incident.
function sentenceFor(e: Schemas['EvidenceItem'], inc: Schemas['IncidentDetail'], sig: Sig): string {
  const s = inc.verdict.cause_summary_slots
  switch (e.kind) {
    case 'probe_failure': return `Every check of your pay page since ${when(inc.verdict.onset_at)} answered ${s.status}${inc.verdict.resolved_at ? ' until it was fixed' : ', and it still does'}.`
    case 'order_attempt_gap': return `${s.zero_attempts} orders were created and nobody tried to pay for them. Normally ${Math.round((sig.normal_zero_share ?? 0.2) * 100)}% are left that way.`
    case 'order_volume_dip': return `${s.observed} orders arrived where about ${s.expected} are normal for these hours.`
    case 'complaint_spike': return `${inc.complained} customers wrote that they could not pay. None had a payment attempt of their own.`
    default: return String(s.change)
  }
}

// How much a signal weighs, in words: the engine scores each one 1 to 3.
const strength = (w: number) => (w >= 3 ? 'Strong' : w === 2 ? 'Medium' : 'Supporting')

export default function Zone1View({ id }: { id: string }) {
  const [version, setVersion] = useState(0)
  const fix = useRef<HTMLDivElement>(null)
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`, version)
  const { data: members } = useGet<Schemas['Member'][]>(`/api/incidents/${id}/members`, version)
  const { data: sample } = useGet<Schemas['SampleTimeline'][]>(`/api/incidents/${id}/sample`, version)
  const { data: pack, error: packError } = useGet<Schemas['EvidencePack']>(`/api/incidents/${id}/evidence_pack`)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!inc || (!pack && !packError)) return <PageSkeleton />  // the page appears whole, so the cards in it do not grow as more of it arrives
  const v = inc.verdict
  const sig = v.signature as unknown as Sig
  const s = v.cause_summary_slots
  const marks = Object.fromEntries(inc.timeline.map((b) => [b.bucket_start, b.markers]))
  const rows = (members ?? []).map((m) => ({ ...m, id: m.payment_id }))
  const firstWrote = (members ?? []).filter((m) => m.complained).map((m) => m.captured_at).sort()[0]
  const ready = inc.tier_counts.exact ?? 0

  const steps = [
    ...(v.linked_event_id ? [{ at: sig.event_at ?? v.onset_at, title: 'The change went live', text: String(s.change), tone: 'neutral' as const }] : []),
    { at: v.onset_at, title: sig.kind === 'probe' ? 'Your pay page started failing' : 'Orders started going unpaid', text: sig.kind === 'probe' ? `Status ${s.status}` : `${s.zero_attempts} orders so far`, tone: 'negative' as const },
    ...(inc.would_have_alerted_at ? [{ at: inc.would_have_alerted_at, title: 'Resolve would have alerted', text: 'Enough evidence from independent places', tone: 'information' as const }] : []),
    ...(firstWrote ? [{ at: firstWrote, title: 'The first customer wrote in', tone: 'notice' as const, text: undefined }] : []),
    ...(v.resolved_at ? [{ at: v.resolved_at, title: sig.kind === 'probe' ? 'Your pay page answered again' : 'Orders got payment attempts again', tone: 'positive' as const, text: undefined }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at))

  const early = inc.would_have_alerted_at ? (sig.kind === 'probe' ? ` With Resolve on, you would have known ${when(inc.would_have_alerted_at)}, minutes after the change and before any customer wrote. This needs the pay-page check switched on.` : ` With Resolve on, you would have known ${when(inc.would_have_alerted_at)}, from the orders and the first complaints.`) : ''
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
              <Text size="small" color="surface.text.gray.muted">{`Cause: ${inc.title}`}</Text>
              <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                <Badge color={OWNER_TONE[inc.owner]} size="medium">{cause(inc)}</Badge>
                <Badge color={STATUS_TONE[inc.status]} size="medium">{sentence(inc.status)}</Badge>
                <Text size="small" color="surface.text.gray.muted">{sentence(v.confidence)} confidence · started {when(inc.onset_at)} · {inc.id}</Text>
              </Box>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <StoryStrip inc={inc} members={members} />

      <Alert isFullWidth color="information" isDismissible={false} title="Razorpay could not see this" description={`Customers never reached a payment, so Razorpay has no record of it. Resolve worked it out from your orders, your pay page and what customers wrote.${early}`} />

      <IncidentStats inc={inc} />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', l: 'minmax(0, 1fr) 320px' }} gap="spacing.6" alignItems="start">
        <Box display="flex" flexDirection="column" gap="spacing.6" minWidth="0px">

          <Panel title="What we saw" subtitle={`${v.evidence.length} signals, strongest first`}>
            <Box display="flex" flexDirection="column">
              {v.evidence.map((e) => (
                <Box key={e.kind + e.ref} display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" gap={{ base: 'spacing.1', m: 'spacing.5' }} paddingY="spacing.3" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Box display="flex" flexDirection="column" flex="1">
                    <Text weight="semibold">{LABEL[e.kind] ?? sentence(e.kind)}</Text>
                    <Text size="small" color="surface.text.gray.muted">{sentenceFor(e, inc, sig)}</Text>
                  </Box>
                  <Box><Badge color="neutral" size="medium">{strength(e.weight)}</Badge></Box>
                </Box>
              ))}
            </Box>
          </Panel>

          <Panel title="Orders and pay-page checks" subtitle="Hour by hour, against what is normal for each hour">
            {/* Each line is named for what happened, in the merchant's words: what broke, and when it was fixed. */}
            <OrdersChart hours={sig.hourly ?? []} marks={marks} edges={sig.kind === 'probe' ? [{ at: v.onset_at, label: 'Pay page broke' }, { at: sig.end, label: 'Pay page fixed' }] : [{ at: v.onset_at, label: 'Checkout broke' }, { at: sig.end, label: 'Checkout fixed' }]} />
          </Panel>

          <EvidenceLane inc={inc} pack={pack} />
          <JustYou inc={inc} lines={['These customers never reached a payment, so there are no payments to compare. Resolve compared your orders and pay-page checks with what is normal for the same hours instead (the chart above).']} />
          <RootCauseActions inc={inc} pack={pack} fix={fix} closed={inc.status === 'closed'} />

          <Panel title="Customers who could not pay" pad={false} trailing={<Text size="small" color="surface.text.gray.muted">{rows.length} customers wrote in or had an order nobody could pay for</Text>}>
            {rows.length === 0 ? (
              <Box padding="spacing.6"><Text color="surface.text.gray.muted">Nobody has been identified yet.</Text></Box>
            ) : (
              <Table data={{ nodes: rows }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(130px, 1.3fr) minmax(260px, 2.6fr) minmax(100px, 1fr) minmax(170px, 1.7fr)" isHeaderSticky={false}>
                {(items) => (
                  <>
                    <TableHeader>
                      <TableHeaderRow>
                        <TableHeaderCell>Customer</TableHeaderCell>
                        <TableHeaderCell>What happened</TableHeaderCell>
                        <TableHeaderCell>Wanted</TableHeaderCell>
                        <TableHeaderCell>Can we message them</TableHeaderCell>
                      </TableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((m) => (
                        <TableRow key={m.payment_id} item={m}>
                          <TableCell>{two(m.customer_masked, when(m.captured_at))}</TableCell>
                          <TableCell><Text size="small">{m.delivery_outcome.replace(/^Wrote on ([a-z ]+):/, (_, c: string) => `Wrote on ${(CHANNEL[c.replace(' ', '_')] ?? c)}:`)}</Text></TableCell>
                          <TableCell>{two(rupees(m.amount_paise), m.plan)}</TableCell>
                          <TableCell>
                            <Box display="flex" flexDirection="column" gap="spacing.2" alignItems="flex-start">
                              <Badge size="medium" color={m.tier === 'exact' ? 'positive' : m.merchant_state === 'paid' || m.merchant_state === 'paid since' ? 'information' : 'neutral'}>{m.tier === 'exact' ? 'Yes, now' : sentence(m.merchant_state)}</Badge>
                              {m.exclusion_reason && <Text size="small" color="surface.text.gray.muted">{m.exclusion_reason}</Text>}
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
            <Panel title={`${sample.length} customers, side by side`} subtitle="What the customer said, what Razorpay recorded and what your pay page did. Check a few before you fix.">
              {sample.map((x) => {
                // These customers never reached a payment, so the engine keys them by its own customer id (cust_...). A merchant reads the masked name, never that id.
                const m = members?.find((y) => y.payment_id === x.payment_id)
                return (
                <Box key={x.payment_id} display="flex" flexDirection="column" gap="spacing.3" paddingBottom="spacing.4" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Text size="small" weight="semibold">{m ? `${m.customer_masked} · ${m.plan} · ${rupees(m.amount_paise)}` : 'A customer'}</Text>
                  <Box display="flex" gap="spacing.5" flexWrap="wrap">
                    {[['Customer says', x.lanes.customer], ['Razorpay says', x.lanes.razorpay], ['Your pay page says', x.lanes.merchant]].map(([t, items]) => (
                      <Box key={t as string} display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="200px">
                        <Text size="small" weight="semibold">{t as string}</Text>
                        {(items as Schemas['LaneEvent'][]).map((e) => <Text key={e.text} size="small">{when(e.at)} · {e.text}</Text>)}
                      </Box>
                    ))}
                  </Box>
                </Box>
                )
              })}
            </Panel>
          )}

          <Box ref={fix} testID="fix-steps"><Zone1Fix inc={inc} onChanged={() => setVersion((n) => n + 1)} /></Box>
          {inc.status !== 'closed' && <FeedbackPanel incidentId={inc.id} />}
        </Box>

        <Box position={{ base: 'static', l: 'sticky' }} top="spacing.5">
          <Card padding="spacing.7">
            <CardBody>
              <Heading as="h2" size="medium">Timeline</Heading>
              <Box marginTop="spacing.5">
                <StepGroup size="medium">
                  {[
                    ...steps.map((st) => <StepItem key={st.title} title={st.title} timestamp={when(st.at)} description={st.text} stepProgress="full" marker={<StepItemIndicator color={st.tone} />} />),
                    <StepItem key="end" title={inc.status === 'closed' ? 'Closed' : 'Still open'} stepProgress="none" description={inc.status === 'closed' ? 'The fix held and every recovery step finished' : `${ready} customers can be sent a link`}
                      marker={inc.status === 'closed' ? <StepItemIndicator color="positive" /> : <LiveStepIndicator color="notice" />} />,
                  ]}
                </StepGroup>
              </Box>
              <StartFix to={fix} closed={inc.status === 'closed'} variant="secondary" wideOnly />
            </CardBody>
          </Card>
        </Box>
      </Box>
    </Box>
  )
}
