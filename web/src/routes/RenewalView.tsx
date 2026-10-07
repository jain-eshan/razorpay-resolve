import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, AlertTriangleIcon, Badge, BellOffIcon, Box, Button, Card, CardBody, CheckCircleIcon, Heading, MessageCircleIcon, StepGroup, StepItem, StepItemIndicator, Table, TableBody,
  TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TablePagination, TableRow, Text,
} from '@razorpay/blade/components'
import { Crumbs } from '../components/Crumbs'
import { Lane } from '../components/Lane'
import { Panel } from '../components/Panel'
import { RenewalChart, type RenewalHour } from '../components/RenewalChart'
import { RenewalFix } from '../components/RenewalFix'
import { Stat } from '../components/Stat'
import { rupees, useGet, type Schemas } from '../lib/api'
import { OWNER, sentence, when } from '../lib/format'

type Sig = { hourly: RenewalHour[]; first_failure_at: string; alert_at: string; resolved_at: string | null; run_length: number }
const STATUS_TONE = { open: 'notice', fixing: 'information', verifying: 'information', closed: 'positive' } as const
const LABEL: Record<string, string> = { renewal_failures: 'Card renewals failed in a row', one_error_code: 'One error code on nearly all of them', several_networks: 'Spread across card networks',
  other_method_fine: 'UPI AutoPay went through', no_change_on_your_side: 'Nothing changed on your side', no_bank_outage: 'No bank outage' }

const two = (top: string, bottom: string) => (
  <Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{top}</Text><Text size="small" color="surface.text.gray.muted">{bottom}</Text></Box>
)

// INC-3: card renewals that failed inside Razorpay's gateway. The cause is Razorpay's, seen by elimination, so the screen says what points there,
// what Blindspot cannot see, and offers the two things the merchant can do: keep customers' access on, and hand Razorpay the evidence.
export default function RenewalView({ id }: { id: string }) {
  const nav = useNavigate()
  const [version, setVersion] = useState(0)
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`, version)
  const { data: members } = useGet<Schemas['Member'][]>(`/api/incidents/${id}/members`, version)
  const { data: sample } = useGet<Schemas['SampleTimeline'][]>(`/api/incidents/${id}/sample`, version)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!inc) return <Text color="surface.text.gray.muted">Loading</Text>
  const v = inc.verdict
  const sig = v.signature as unknown as Sig
  const s = v.cause_summary_slots
  const marks = Object.fromEntries(inc.timeline.map((b) => [b.bucket_start, b.markers]))
  const rows = (members ?? []).map((m) => ({ ...m, id: m.payment_id }))
  const keep = inc.tier_counts.exact ?? 0
  const atAlert = members ? members.filter((m) => m.captured_at <= sig.alert_at).length : null   // failed renewals in the run by the time the alert fires

  const steps = [
    { at: v.onset_at, title: 'Card renewals started failing', text: `${s.code}, no fault of the customer's card`, tone: 'negative' as const },
    { at: sig.alert_at, title: 'You could have known', text: atAlert ? `After ${atAlert} failed renewals in a row` : undefined, tone: 'information' as const },
    ...(v.resolved_at ? [{ at: v.resolved_at, title: 'Card renewals went through again', tone: 'positive' as const, text: undefined }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <Crumbs items={[{ label: 'Incidents', to: '/incidents' }, { label: inc.id, to: `/incidents/${inc.id}` }]} />

      <Card padding="spacing.5">
        <CardBody>
          <Box display="flex" gap="spacing.5" alignItems="center" flexWrap="wrap">
            <Box width="56px" height="56px" borderRadius="medium" backgroundColor="feedback.background.negative.subtle" display="flex" alignItems="center" justifyContent="center">
              <AlertTriangleIcon size="xlarge" color="feedback.icon.negative.intense" />
            </Box>
            <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="240px">
              <Heading size="medium">{inc.title}</Heading>
              <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                <Badge color="negative" size="medium">{OWNER[inc.owner]}</Badge>
                <Badge color={STATUS_TONE[inc.status]} size="medium">{sentence(inc.status)}</Badge>
                <Text size="small" color="surface.text.gray.muted">Confidence {v.confidence} · started {when(inc.onset_at)} · {inc.id}</Text>
              </Box>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <Alert isFullWidth color="information" isDismissible={false} title="This one is on Razorpay's side"
        description="Your card renewals failed inside Razorpay's gateway. Nothing changed on your side and your webhook was healthy. Blindspot cannot see inside Razorpay, so it shows what points there and what it cannot see, and says how sure it is." />

      <Box display="grid" gridTemplateColumns={{ base: 'repeat(2, minmax(0, 1fr))', l: 'repeat(4, minmax(0, 1fr))' }} gap="spacing.5">
        <Stat label="Renewals failed" value={String(inc.affected)} hint={`${rupees(inc.at_risk_paise)} still to collect`} icon={AlertTriangleIcon} tone="negative" />
        <Stat label="Wrote to you" value={String(inc.complained)} icon={MessageCircleIcon} />
        <Stat label="Silent" value={String(inc.silent)} hint="never wrote" icon={BellOffIcon} />
        <Stat label="Paid again" value={String(inc.fixed)} hint="on their own, left alone" icon={CheckCircleIcon} tone="positive" />
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: '1fr', l: 'minmax(0, 1fr) 320px' }} gap="spacing.6" alignItems="start">
        <Box display="flex" flexDirection="column" gap="spacing.6" minWidth="0px">
          {inc.would_have_alerted_at && (
            <Alert isFullWidth color="information" isDismissible={false} title="With this on" description={`You would have known ${when(inc.would_have_alerted_at)}${atAlert ? `, after ${atAlert} failed card renewals in a row` : ''}.`} />
          )}

          <Panel title="What we saw" subtitle={`Pointing at Razorpay: ${v.evidence.length} pieces of evidence, ${v.evidence.reduce((a, e) => a + e.weight, 0)} points`}>
            <Box display="flex" flexDirection="column">
              {v.evidence.map((e) => (
                <Box key={e.kind + e.ref} display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" gap={{ base: 'spacing.1', m: 'spacing.5' }} paddingY="spacing.3" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Box display="flex" flexDirection="column" flex="1">
                    <Text weight="semibold">{LABEL[e.kind] ?? sentence(e.kind)}</Text>
                    <Text size="small" color="surface.text.gray.muted">{e.ref}</Text>
                  </Box>
                  <Box><Badge color="neutral" size="medium">{`${e.weight} ${e.weight === 1 ? 'point' : 'points'}`}</Badge></Box>
                </Box>
              ))}
            </Box>
            {v.what_we_cannot_see.map((t) => <Text key={t} size="small" color="surface.text.gray.muted">We cannot see: {t}</Text>)}
          </Panel>

          <Panel title="Renewals by the hour" subtitle="Card against UPI AutoPay, in the same hours">
            <RenewalChart hours={sig.hourly ?? []} marks={marks} />
          </Panel>

          <Panel title="Customers whose renewal failed" pad={false} trailing={<Text size="small" color="surface.text.gray.muted">{rows.length} renewals, {keep} to keep access on for</Text>}>
            {rows.length === 0 ? (
              <Box padding="spacing.6"><Text color="surface.text.gray.muted">None.</Text></Box>
            ) : (
              <Table data={{ nodes: rows }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(130px, 1.3fr) minmax(230px, 2.3fr) minmax(110px, 1.1fr) minmax(170px, 1.7fr)" isHeaderSticky={false}>
                {(items) => (
                  <>
                    <TableHeader>
                      <TableHeaderRow>
                        <TableHeaderCell>Customer</TableHeaderCell>
                        <TableHeaderCell>What happened</TableHeaderCell>
                        <TableHeaderCell>Renewal</TableHeaderCell>
                        <TableHeaderCell>Your records</TableHeaderCell>
                      </TableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((m) => (
                        <TableRow key={m.payment_id} item={m}>
                          <TableCell>{two(m.customer_masked, m.payment_id)}</TableCell>
                          <TableCell>{two(m.delivery_outcome, when(m.captured_at))}</TableCell>
                          <TableCell>{two(rupees(m.amount_paise), m.plan)}</TableCell>
                          <TableCell>
                            <Box display="flex" flexDirection="column" gap="spacing.2" alignItems="flex-start">
                              <Box display="flex" gap="spacing.2" flexWrap="wrap">
                                <Badge size="medium" color={m.merchant_state === 'active' ? 'positive' : 'negative'}>{sentence(m.merchant_state)}</Badge>
                                <Badge size="medium" color={m.complained ? 'notice' : 'neutral'}>{m.complained ? 'Wrote in' : 'Silent'}</Badge>
                              </Box>
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
            <Panel title={`Look at ${sample.length} before acting`} subtitle="Customer, Razorpay and your records, side by side">
              {sample.map((x) => (
                <Box key={x.payment_id} display="flex" flexDirection="column" gap="spacing.3" paddingBottom="spacing.4" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Text size="small" color="surface.text.gray.muted">{x.payment_id}</Text>
                  <Box display="flex" gap="spacing.5" flexWrap="wrap">
                    <Lane title="Customer says" items={x.lanes.customer} />
                    <Lane title="Razorpay says" items={x.lanes.razorpay} />
                    <Lane title="Your records say" items={x.lanes.merchant} />
                  </Box>
                </Box>
              ))}
            </Panel>
          )}

          <RenewalFix inc={inc} members={members ?? []} onChanged={() => setVersion((n) => n + 1)} />
        </Box>

        <Box position={{ base: 'static', l: 'sticky' }} top="spacing.5">
          <Card padding="spacing.7">
            <CardBody>
              <Heading size="medium">Timeline</Heading>
              <Box marginTop="spacing.5">
                <StepGroup size="medium">
                  {[
                    ...steps.map((st) => <StepItem key={st.title} title={st.title} timestamp={when(st.at)} description={st.text} stepProgress="full" marker={<StepItemIndicator color={st.tone} />} />),
                    <StepItem key="end" title={inc.status === 'closed' ? 'Closed' : 'Still open'} stepProgress="none" description={inc.status === 'closed' ? 'Access is kept and cards work again' : `${keep} customers still to keep access on for`}
                      marker={<StepItemIndicator color={inc.status === 'closed' ? 'positive' : 'notice'} />} />,
                  ]}
                </StepGroup>
              </Box>
              <Box marginTop="spacing.5"><Button variant="tertiary" size="small" onClick={() => nav(`/incidents/${inc.id}/dev`)}>Open the evidence page</Button></Box>
            </CardBody>
          </Card>
        </Box>
      </Box>
    </Box>
  )
}
