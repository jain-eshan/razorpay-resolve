import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { Lane } from '../components/Lane'
import { useGet, type Schemas } from '../lib/api'
import { PageHeader } from '../components/PageHeader'

// S-04: the customer says, Razorpay says, your records say. Closest guesses are for the founder only and are never shown to the customer.
export default function Case() {
  const { id = '' } = useParams()
  const { data: c, error } = useGet<Schemas['CaseDetail']>(`/api/cases/${id}`)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!c) return <Text color="surface.text.gray.muted">Loading</Text>
  const x = c.extraction as Record<string, unknown>
  const exact = c.candidates.filter((k) => k.method !== 'fuzzy')
  const guesses = c.candidates.filter((k) => k.method === 'fuzzy')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Link to="/threads" style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">All conversations</Text></Link>
      <PageHeader title="Case" description={c.state_line} actions={
        <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
          <Badge color={c.match_status === 'matched' ? 'positive' : 'notice'}>{c.match_status.replaceAll('_', ' ')}</Badge>
          {c.incident_id && <Link to={`/incidents/${c.incident_id}`}><Badge color="neutral">{c.incident_id}</Badge></Link>}
        </Box>
      } />
      {c.injection_suspected && <Alert isFullWidth color="negative" isDismissible={false} title="This message tried to give the system instructions" description="It was treated as data and not followed. A person has the thread." />}

      <Card><CardBody>
        <Box display="flex" gap="spacing.5" flexWrap="wrap">
          <Lane title="Customer says" items={c.lanes.customer} />
          <Lane title="Razorpay says" items={c.lanes.razorpay} />
          <Lane title="Your records say" items={c.lanes.merchant} />
        </Box>
      </CardBody></Card>

      <Box display="flex" flexDirection="column" gap="spacing.3">
        <Heading size="medium">What the agent understood</Heading>
        <Text size="small">
          {String(x.claim ?? 'unknown').replaceAll('_', ' ')}
          {x.amount_paise ? ` · ₹${Number(x.amount_paise) / 100}` : ''}{x.method && x.method !== 'unknown' ? ` · ${String(x.method)}` : ''}
          {x.app_or_bank_name ? ` · ${String(x.app_or_bank_name)}` : ''}{x.stated_time_text ? ` · "${String(x.stated_time_text)}"` : ''} · {String(x.language ?? '').replace('_', ' ')}
        </Text>
        <Text size="small" color="surface.text.gray.muted">Identifiers are stored as tokens. Only exact identifiers decide a match.</Text>
      </Box>

      {exact.length > 0 && (
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <Heading size="medium">Found by an exact identifier</Heading>
          {exact.map((k) => <Text key={k.payment_id}>{k.payment_id} · {k.method.replace('exact_', '').replace('_', ' ')} · confidence {Math.round(k.calibrated_score * 100)}%</Text>)}
        </Box>
      )}
      {guesses.length > 0 && (
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <Heading size="medium">Closest guesses</Heading>
          <Text size="small" color="surface.text.gray.muted">For you only. Never shown to the customer, and never used to act.</Text>
          {guesses.map((k) => <Text key={k.payment_id}>{k.payment_id} · {Math.round(k.calibrated_score * 100)}%</Text>)}
        </Box>
      )}
      {c.reply_draft && (
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <Heading size="medium">Reply waiting for you</Heading>
          <Text>{c.reply_draft}</Text>
        </Box>
      )}
    </Box>
  )
}
