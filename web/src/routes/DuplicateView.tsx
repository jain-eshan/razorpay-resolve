import { useRef, useState } from 'react'
import {
  Alert, AlertTriangleIcon, Badge, Box, Card, CardBody, Heading, SegmentedControl, SegmentedControlItem, StepGroup, StepItem,
  StepItemIndicator, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TablePagination, TableRow, Text,
} from '@razorpay/blade/components'
import { LiveStepIndicator } from '../components/Pulse'
import { Crumbs } from '../components/Crumbs'
import { DuplicateChart } from '../components/DuplicateChart'
import { DuplicateFix } from '../components/DuplicateFix'
import { Lane } from '../components/Lane'
import { Panel } from '../components/Panel'
import { EvidenceLane } from '../components/EvidenceLane'
import { IncidentStats } from '../components/IncidentStats'
import { JustYou } from '../components/JustYou'
import { RootCauseActions } from '../components/RootCauseActions'
import { StartFix } from '../components/StartFix'
import { StoryStrip } from '../components/StoryStrip'
import { rupees, useGet, type Schemas } from '../lib/api'
import { cause, headline, sentence, when } from '../lib/format'
import { PageSkeleton } from '../components/PageSkeleton'

type Sig = { app_version: string; release_at: string | null; first_at: string; alert_at: string; pairs: number }
const STATUS_TONE = { open: 'notice', fixing: 'information', verifying: 'information', closed: 'positive' } as const
const TIERS = ['exact', 'excluded'] as const
const TIER_LABEL = { exact: 'Charged twice', excluded: 'Left out' }
const LABEL: Record<string, string> = { duplicate_pairs: 'Charged twice, seconds apart', one_app_version: 'All on one app version', after_release: 'Began at an app release', share_of_orders: "Share of that version's orders",
  left_out: 'Look-alikes left out', webhook_healthy: 'Your webhook was fine' }

const two = (top: string, bottom: string) => (
  <Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{top}</Text><Text size="small" color="surface.text.gray.muted">{bottom}</Text></Box>
)

// INC-2: customers charged twice after an Android release. Both charges reached the merchant's server and both orders got access, so the only harm is the
// second charge. The cause is the merchant's app. The screen shows the evidence, what was left out and why, and the two things the founder can do:
// refund each second charge to the original payment method, one customer at a time, and tell the developer what to fix.
// How much a signal weighs, in words: the engine scores each one 1 to 3.
const strength = (w: number) => (w >= 3 ? 'Strong' : w === 2 ? 'Medium' : 'Supporting')

export default function DuplicateView({ id }: { id: string }) {
  const [version, setVersion] = useState(0)
  const fix = useRef<HTMLDivElement>(null)
  const [tier, setTier] = useState<(typeof TIERS)[number]>('exact')
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`, version)
  const { data: members } = useGet<Schemas['Member'][]>(`/api/incidents/${id}/members`, version)
  const { data: sample } = useGet<Schemas['SampleTimeline'][]>(`/api/incidents/${id}/sample`, version)
  const { data: pack, error: packError } = useGet<Schemas['EvidencePack']>(`/api/incidents/${id}/evidence_pack`)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!inc || (!pack && !packError)) return <PageSkeleton />  // the page appears whole, so the cards in it do not grow as more of it arrives
  const v = inc.verdict
  const sig = v.signature as unknown as Sig
  const rows = (members ?? []).filter((m) => m.tier === tier).map((m) => ({ ...m, id: m.payment_id }))
  const atAlert = members ? members.filter((m) => m.tier === 'exact' && m.captured_at <= sig.alert_at).length : null   // double charges by the time the alert fires

  const steps = [
    ...(sig.release_at ? [{ at: sig.release_at, title: `${sig.app_version} released`, text: 'The Pay button could be tapped twice', tone: 'neutral' as const }] : []),
    { at: sig.first_at, title: 'First customer charged twice', text: `Two orders for the same plan, seconds apart`, tone: 'negative' as const },
    { at: sig.alert_at, title: 'Resolve would have alerted', text: atAlert ? `After ${atAlert} double charges from ${sig.app_version}` : undefined, tone: 'information' as const },
  ].sort((a, b) => a.at.localeCompare(b.at))
  const done = inc.status === 'closed'

  const early = inc.would_have_alerted_at ? ` With Resolve on, you would have known ${when(inc.would_have_alerted_at)}${atAlert ? `, after ${atAlert} customers were charged twice` : ''}.` : ''
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
                <Badge color="notice" size="medium">{cause(inc)}</Badge>
                <Badge color={STATUS_TONE[inc.status]} size="medium">{sentence(inc.status)}</Badge>
                <Text size="small" color="surface.text.gray.muted">{sentence(v.confidence)} confidence · started {when(inc.onset_at)} · {inc.id}</Text>
              </Box>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <StoryStrip inc={inc} members={members} />

      <Alert isFullWidth color="information" isDismissible={false} title="Your webhook was fine. The second charge is the problem"
        description={`Both charges reached your server and both orders got access. The Pay button in ${sig.app_version} lets a second tap place a second order, so the customer pays twice for one plan. Resolve can refund the second charge to the original payment method, one customer at a time, once you approve each.${early}`} />

      <IncidentStats inc={inc} />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', l: 'minmax(0, 1fr) 320px' }} gap="spacing.6" alignItems="start">
        <Box display="flex" flexDirection="column" gap="spacing.6" minWidth="0px">

          <Panel title="What we saw" subtitle={`${v.evidence.length} signals pointing at your side, strongest first`}>
            <Box display="flex" flexDirection="column">
              {v.evidence.map((e) => (
                <Box key={e.kind + e.ref} display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" gap={{ base: 'spacing.1', m: 'spacing.5' }} paddingY="spacing.3" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Box display="flex" flexDirection="column" flex="1">
                    <Text weight="semibold">{LABEL[e.kind] ?? sentence(e.kind)}</Text>
                    <Text size="small" color="surface.text.gray.muted">{e.ref}</Text>
                  </Box>
                  <Box><Badge color="neutral" size="medium">{strength(e.weight)}</Badge></Box>
                </Box>
              ))}
            </Box>
          </Panel>

          <Panel title={`Orders from ${sig.app_version} by day`} subtitle="The red part is the second order of a double tap">
            <DuplicateChart buckets={inc.timeline} marks={[{ at: sig.release_at, label: 'App released' }]} />
          </Panel>

          <EvidenceLane inc={inc} pack={pack} />
          <JustYou inc={inc} />
          <RootCauseActions inc={inc} pack={pack} fix={fix} closed={done} />

          <Panel title="Customers" pad={false} trailing={<Text size="small" color="surface.text.gray.muted">{members?.length ?? 0} looked at, {inc.tier_counts.exact ?? 0} to refund</Text>}>
            <Box padding="spacing.5">
              <SegmentedControl label="Group" name="tier" value={tier} onChange={({ value }) => setTier(value as (typeof TIERS)[number])}>
                {TIERS.map((t) => <SegmentedControlItem key={t} value={t}>{TIER_LABEL[t]} ({inc.tier_counts[t] ?? 0})</SegmentedControlItem>)}
              </SegmentedControl>
            </Box>
            {rows.length === 0 ? (
              <Box padding="spacing.6"><Text color="surface.text.gray.muted">None in this group.</Text></Box>
            ) : (
              <Table data={{ nodes: rows }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(150px, 1.4fr) minmax(230px, 2.3fr) minmax(110px, 1.1fr) minmax(170px, 1.7fr)" isHeaderSticky={false}>
                {(items) => (
                  <>
                    <TableHeader>
                      <TableHeaderRow>
                        <TableHeaderCell>Customer</TableHeaderCell>
                        <TableHeaderCell>What happened</TableHeaderCell>
                        <TableHeaderCell>Second charge</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                      </TableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((m) => (
                        <TableRow key={m.payment_id} item={m}>
                          <TableCell>{two(m.customer_masked, m.payment_id)}</TableCell>
                          <TableCell>{two(m.delivery_outcome, `${when(m.captured_at)}${m.exclusion_reason ? ` · ${m.exclusion_reason}` : ''}`)}</TableCell>
                          <TableCell>{two(rupees(m.amount_paise), m.plan)}</TableCell>
                          <TableCell>
                            <Box display="flex" gap="spacing.2" flexWrap="wrap">
                              <Badge size="medium" color={m.merchant_state.startsWith('refund') ? 'positive' : m.tier === 'exact' ? 'negative' : 'neutral'}>{sentence(m.merchant_state)}</Badge>
                              {m.tier === 'exact' && <Badge size="medium" color={m.complained ? 'notice' : 'neutral'}>{m.complained ? 'Wrote in' : 'Silent'}</Badge>}
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
              {sample.map((x) => {
                const m = members?.find((y) => y.payment_id === x.payment_id)
                return (
                <Box key={x.payment_id} display="flex" flexDirection="column" gap="spacing.3" paddingBottom="spacing.4" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                    {m && <Text size="small" weight="semibold">{`${m.customer_masked} · ${rupees(m.amount_paise)}`}</Text>}
                    <Text size="small" color="surface.text.gray.muted">{x.payment_id}</Text>
                  </Box>
                  <Box display="flex" gap="spacing.5" flexWrap="wrap">
                    <Lane title="Customer says" items={x.lanes.customer} empty="Did not write in" />
                    <Lane title="Razorpay says" items={x.lanes.razorpay} />
                    <Lane title="Your records say" items={x.lanes.merchant} />
                  </Box>
                </Box>
                )
              })}
            </Panel>
          )}

          <Box ref={fix} testID="fix-steps"><DuplicateFix inc={inc} onChanged={() => setVersion((n) => n + 1)} /></Box>
        </Box>

        <Box position={{ base: 'static', l: 'sticky' }} top="spacing.5">
          <Card padding="spacing.7">
            <CardBody>
              <Heading as="h2" size="medium">Timeline</Heading>
              <Box marginTop="spacing.5">
                <StepGroup size="medium">
                  {[
                    ...steps.map((st) => <StepItem key={st.title} title={st.title} timestamp={when(st.at)} description={st.text} stepProgress="full" marker={<StepItemIndicator color={st.tone} />} />),
                    <StepItem key="end" title={done ? 'Closed' : 'Still open'} stepProgress="none" description={done ? 'Everyone is refunded and the app is fixed' : `${inc.tier_counts.exact - inc.fixed} customers still to refund`}
                      marker={done ? <StepItemIndicator color="positive" /> : <LiveStepIndicator color="notice" />} />,
                  ]}
                </StepGroup>
              </Box>
              <StartFix to={fix} closed={done} variant="secondary" wideOnly />
            </CardBody>
          </Card>
        </Box>
      </Box>
    </Box>
  )
}
