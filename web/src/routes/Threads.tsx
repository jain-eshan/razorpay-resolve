import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { ThreadView } from '../components/ThreadView'
import { isLive, useGet, type Schemas } from '../lib/api'
import { demoNote } from '../lib/demo'
import { when } from '../lib/format'

const DEMOS = [['/chat-demo', 'Talk to it on WhatsApp'], ['/help-demo/receipt', 'Tap help on a receipt'], ['/email-demo', 'Write to it by email']] as const

// S-04 list and S-14 founder side: every conversation, newest first, and the complaints that were already in the data.
export function Threads() {
  const [v, setV] = useState(0)
  const { data: threads, error } = useGet<Schemas['ThreadSummary'][]>('/api/threads', v)
  const { data: cases } = useGet<Schemas['CaseSummary'][]>('/api/cases', v)
  void setV
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="xlarge">Conversations</Heading>
        <Text color="surface.text.gray.muted">Customers who wrote to your payment help. The agent finds their payment, says what your records show, and hands over when a person is needed.</Text>
      </Box>
      {!isLive && <Alert color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Conversations appear here once you start one from the links below.`} />}
      {(
        <Box display="flex" gap="spacing.5" flexWrap="wrap">
          {DEMOS.map(([to, label]) => <Link key={to} to={to}><Text color="interactive.text.primary.normal">{label}</Text></Link>)}
        </Box>
      )}
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      {threads?.length === 0 && <Text color="surface.text.gray.muted">No conversations yet.</Text>}
      {threads?.map((t) => (
        <Link key={t.id} to={`/threads/${t.id}`} style={{ textDecoration: 'none' }}>
          <Card><CardBody>
            <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
              <Text weight="semibold">{t.channel.replaceAll('_', ' ')}</Text>
              <Badge color={t.state === 'human' || t.state === 'handoff' ? 'negative' : t.state === 'resolved' || t.state === 'wait_for_fix' ? 'positive' : 'neutral'}>{t.state.replaceAll('_', ' ')}</Badge>
              {t.incident_id && <Badge color="neutral">{t.incident_id}</Badge>}
              <Text size="small" color="surface.text.gray.muted">{when(t.last_inbound_at)} · {t.customer_ref}</Text>
            </Box>
          </CardBody></Card>
        </Link>
      ))}

      <Box display="flex" flexDirection="column" gap="spacing.4">
        <Heading size="medium">Complaints</Heading>
        {cases?.map((c) => (
          <Link key={c.id} to={`/cases/${c.id}`} style={{ textDecoration: 'none' }}>
            <Card><CardBody>
              <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
                <Text weight="semibold">{c.channel.replaceAll('_', ' ')}</Text>
                <Badge color={c.match_status === 'matched' ? 'positive' : 'notice'}>{c.match_status.replaceAll('_', ' ')}</Badge>
                {c.incident_id && <Badge color="neutral">{c.incident_id}</Badge>}
                <Text size="small" color="surface.text.gray.muted">{when(c.received_at)}</Text>
              </Box>
            </CardBody></Card>
          </Link>
        ))}
      </Box>
    </Box>
  )
}

export function ThreadPage() {
  const { id = '' } = useParams()
  const [v, setV] = useState(0)
  const { data, error } = useGet<Schemas['ThreadDetail']>(`/api/threads/${id}`, v)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!data) return <Text color="surface.text.gray.muted">Loading</Text>
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Box display="flex" gap="spacing.5" flexWrap="wrap">
        <Link to="/threads" style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">All conversations</Text></Link>
        {data.case && <Link to={`/cases/${data.case.id}`} style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">Open the case</Text></Link>}
      </Box>
      <ThreadView thread={data} onChanged={() => setV((n) => n + 1)} />
    </Box>
  )
}
