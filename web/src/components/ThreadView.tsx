import { useState } from 'react'
import { Alert, Badge, Box, Button, Card, CardBody, Heading, RayIcon, Text, TextArea } from '@razorpay/blade/components'
import { isLive, send, type Schemas } from '../lib/api'
import { when } from '../lib/format'

type Thread = Schemas['ThreadDetail']
const STATE: Record<string, [string, 'positive' | 'notice' | 'neutral' | 'negative' | 'information']> = {
  opened: ['Opened', 'neutral'], triage: ['Reading', 'neutral'], identify: ['Finding the payment', 'notice'], lookup: ['Looking up', 'neutral'], matched: ['Matched', 'positive'],
  explain: ['Explained', 'positive'], wait_for_fix: ['Waiting for the fix', 'notice'], resolved: ['Resolved', 'positive'], not_found: ['Not found', 'notice'],
  human: ['Needs you', 'negative'], handoff: ['Needs you', 'negative'], pass_back: ['Not about a payment', 'neutral'], closed: ['Closed', 'neutral'],
}

// The founder's view of one conversation: what the customer wrote (identifiers already replaced by tokens), what the agent said or is holding for approval, and the brief when a person is needed.
export function ThreadView({ thread, onChanged }: { thread: Thread; onChanged: () => void }) {
  const [own, setOwn] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [label, tone] = STATE[thread.state] ?? [thread.state, 'neutral']
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(undefined)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const hasDraft = thread.messages.some((m) => m.direction === 'outbound' && m.policy.status === 'draft')

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="thread-view">
      <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
        <Heading size="medium">{thread.channel.replaceAll('_', ' ')}</Heading>
        <Badge color={tone}>{label}</Badge>
        {thread.incident_id && <Badge color="neutral">{thread.incident_id}</Badge>}
        <Text size="small" color="surface.text.gray.muted">{thread.customer_ref} · {thread.language.replace('_', ' ')} · {thread.question_count} of 3 questions</Text>
      </Box>

      {thread.founder_brief && (
        <Alert color="notice" isDismissible={false} title="Why this needs you" description={thread.founder_brief} />
      )}
      {error && <Alert color="negative" isDismissible={false} title="Not sent" description={error} />}

      <Box display="flex" flexDirection="column" gap="spacing.4">
        {thread.messages.map((m) => {
          const customer = m.direction === 'inbound'
          const status = m.policy.status as string | undefined
          return (
            <Box key={m.id} display="flex" gap="spacing.3" flexDirection={customer ? 'row-reverse' : 'row'} alignItems="flex-start">
              {!customer && m.sender_role === 'agent' && <RayIcon size="large" color="surface.icon.onSea.onSubtle" />}
              <Box maxWidth="560px" backgroundColor={customer ? 'surface.background.gray.intense' : 'surface.background.gray.subtle'} borderRadius="large" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.2">
                <Text>{m.body}</Text>
                <Text size="small" color="surface.text.gray.muted">
                  {customer ? 'Customer' : m.sender_role === 'founder' ? 'You' : 'Agent'} · {when(m.created_at)}
                  {status === 'sent' && ` · sent${m.approved_by === 'auto' ? ' by itself' : ` · approved by ${m.approved_by?.replace('merchant:', '')}`}`}
                </Text>
                {status === 'draft' && (
                  <Box display="flex" flexDirection="column" gap="spacing.2">
                    <Badge color="notice">Held for you</Badge>
                    {(m.policy.reasons as string[] | undefined)?.map((r) => <Text key={r} size="small" color="feedback.text.notice.intense">{r}</Text>)}
                  </Box>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>

      <Box display="flex" gap="spacing.4" flexWrap="wrap">
        {hasDraft && <Button isDisabled={busy} onClick={() => act(() => send('POST', `/api/threads/${thread.id}/reply`, { approved_by: 'founder' }))}>Approve and send</Button>}
        {isLive && thread.state !== 'handoff' && thread.state !== 'human' && thread.state !== 'resolved' && thread.state !== 'pass_back' && (
          <Button variant="secondary" isDisabled={busy} onClick={() => act(() => send('POST', `/api/threads/${thread.id}/handoff`, { reason: 'You took over this conversation.' }))}>I will take this one</Button>
        )}
      </Box>

      {isLive && thread.state !== 'pass_back' && (
        <Card>
          <CardBody>
            <Box display="flex" flexDirection="column" gap="spacing.3">
              <TextArea label="Reply in your own words" value={own} onChange={({ value }) => setOwn(value ?? '')} numberOfLines={2} helpText="The same checks apply: no asking for OTP, PIN or card details, and only inside the message window." />
              <Box><Button variant="secondary" isDisabled={busy || !own.trim()} onClick={() => act(async () => { await send('POST', `/api/threads/${thread.id}/reply`, { approved_by: 'founder', body: own }); setOwn('') })}>Send</Button></Box>
            </Box>
          </CardBody>
        </Card>
      )}
    </Box>
  )
}
