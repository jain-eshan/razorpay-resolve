import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Box, Button, Card, CardBody, Heading, SegmentedControl, SegmentedControlItem, Text } from '@razorpay/blade/components'
import { FixPanel } from '../components/FixPanel'
import { Lane } from '../components/Lane'
import { Stat } from '../components/Stat'
import { TimelineChart } from '../components/TimelineChart'
import { rupees, useGet, type Schemas } from '../lib/api'
import { OWNER, when } from '../lib/format'

const TIERS = ['exact', 'likely', 'check', 'excluded'] as const
const TIER_LABEL = { exact: 'Exact', likely: 'Likely', check: 'Check manually', excluded: 'Excluded' }
const SHOW = 12

export default function Incident() {
  const { id = '' } = useParams()
  const [version, setVersion] = useState(0)
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`, version)
  const { data: members } = useGet<Schemas['Member'][]>(`/api/incidents/${id}/members`, version)
  const { data: sample } = useGet<Schemas['SampleTimeline'][]>(`/api/incidents/${id}/sample`, version)
  const [tier, setTier] = useState<(typeof TIERS)[number]>('exact')
  const [all, setAll] = useState(false)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!inc) return <Text color="surface.text.gray.muted">Loading</Text>
  const v = inc.verdict
  const rows = (members ?? []).filter((m) => m.tier === tier)
  const atAlert = inc.would_have_alerted_at && members ? members.filter((m) => m.captured_at <= inc.would_have_alerted_at!).length : null

  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Link to="/incidents" style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">All incidents</Text></Link>

      <Alert color="notice" isDismissible={false} title={`${inc.inferred ? 'Inferred. ' : ''}${OWNER[inc.owner]} · confidence ${v.confidence}`} description={inc.title} />

      <Box display="grid" gridTemplateColumns={{ base: '1fr 1fr', m: 'repeat(5, 1fr)' }} gap="spacing.5">
        <Stat label="Affected" value={String(inc.affected)} />
        <Stat label="Complained" value={String(inc.complained)} />
        <Stat label="Silent" value={String(inc.silent)} />
        <Stat label="Already fixed" value={String(inc.fixed)} />
        <Stat label="At risk" value={rupees(inc.at_risk_paise)} />
      </Box>

      {inc.would_have_alerted_at && atAlert !== null && (
        <Alert color="information" isDismissible={false} title="With this on" description={`You would have known ${when(inc.would_have_alerted_at)}, when ${atAlert} customer was affected. The first complaint came days later.`} />
      )}

      <Box display="flex" flexDirection="column" gap="spacing.4">
        <Heading size="medium">What your server did</Heading>
        <TimelineChart buckets={inc.timeline} />
      </Box>

      <Box display="flex" flexDirection="column" gap="spacing.3">
        <Heading size="medium">Evidence</Heading>
        {inc.lift.map((l) => (
          <Text key={l.dimension + l.value}>
            {l.dimension.replace('_', ' ')}: {l.value} · {Math.round(l.share_affected * 100)}% of affected vs {(l.share_baseline * 100).toFixed(1)}% normally
          </Text>
        ))}
        {v.evidence.map((e) => <Text key={e.ref} size="small" color="surface.text.gray.muted">{e.kind.replaceAll('_', ' ')} · weight {e.weight}</Text>)}
        {v.what_we_cannot_see.map((s) => <Text key={s} size="small" color="surface.text.gray.muted">We cannot see: {s}</Text>)}
      </Box>

      <Box display="flex" flexDirection="column" gap="spacing.3">
        <Heading size="medium">Can Razorpay replay these?</Heading>
        <Text>
          {inc.replay.replayable_by_support} yes, by a support ticket, one event at a time. {inc.replay.not_replayable_disabled_window} no, because they were sent while the webhook was off.
        </Text>
        <Text size="small" color="surface.text.gray.muted">{inc.replay.note}</Text>
      </Box>

      <Box display="flex" flexDirection="column" gap="spacing.4">
        <Heading size="medium">Affected customers</Heading>
        <SegmentedControl label="Confidence group" name="tier" value={tier} onChange={({ value }) => { setTier(value as (typeof TIERS)[number]); setAll(false) }}>
          {TIERS.map((t) => (
            <SegmentedControlItem key={t} value={t}>{TIER_LABEL[t]} ({inc.tier_counts[t] ?? 0})</SegmentedControlItem>
          ))}
        </SegmentedControl>
        {rows.length === 0 && <Text color="surface.text.gray.muted">None in this group.</Text>}
        {(all ? rows : rows.slice(0, SHOW)).map((m) => (
          <Card key={m.payment_id}>
            <CardBody>
              <Box display="grid" gridTemplateColumns={{ base: '1fr', m: '1.1fr 0.7fr 1.6fr 1.2fr 1.4fr' }} gap="spacing.3">
                <Box><Text weight="semibold">{m.customer_masked}</Text><Text size="small" color="surface.text.gray.muted">{m.payment_id}</Text></Box>
                <Box><Text>{rupees(m.amount_paise)}</Text><Text size="small" color="surface.text.gray.muted">{m.plan}</Text></Box>
                <Box><Text size="small">{m.delivery_outcome}</Text><Text size="small" color="surface.text.gray.muted">{when(m.captured_at)}</Text></Box>
                <Box><Text size="small">Your records: {m.merchant_state}</Text><Text size="small" color={m.complained ? 'feedback.text.notice.intense' : 'surface.text.gray.muted'}>{m.complained ? 'Complained' : 'Silent'}</Text></Box>
                <Text size="small" color="surface.text.gray.muted">{m.exclusion_reason ?? m.replay_eligibility.replaceAll('_', ' ')}</Text>
              </Box>
            </CardBody>
          </Card>
        ))}
        {!all && rows.length > SHOW && <Button variant="secondary" size="small" onClick={() => setAll(true)}>Show all {rows.length}</Button>}
      </Box>

      {sample && sample.length > 0 && (
        <Box display="flex" flexDirection="column" gap="spacing.4">
          <Heading size="medium">Look at {sample.length} before acting</Heading>
          {sample.map((s) => (
            <Card key={s.payment_id}>
              <CardBody>
                <Text size="small" color="surface.text.gray.muted">{s.payment_id}</Text>
                <Box display="flex" gap="spacing.5" flexWrap="wrap" marginTop="spacing.3">
                  <Lane title="Customer says" items={s.lanes.customer} />
                  <Lane title="Razorpay says" items={s.lanes.razorpay} />
                  <Lane title="Your records say" items={s.lanes.merchant} />
                </Box>
              </CardBody>
            </Card>
          ))}
        </Box>
      )}

      <FixPanel inc={inc} members={members ?? []} onChanged={() => setVersion((v) => v + 1)} />

      <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
        <Link to={`/incidents/${inc.id}/dev`}><Button variant="secondary" size="small">Send to your developer</Button></Link>
        <Text size="small" color="surface.text.gray.muted">Synthetic data: the merchant and customers are fictional.</Text>
      </Box>
    </Box>
  )
}
