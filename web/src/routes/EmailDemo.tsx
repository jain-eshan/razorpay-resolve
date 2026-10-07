import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Box, Button, Card, CardBody, Heading, Text, TextArea, TextInput } from '@razorpay/blade/components'
import { isLive, send, type Schemas } from '../lib/api'
import { demoNote } from '../lib/demo'
import { useLiveThread } from '../lib/live'
import { when } from '../lib/format'

// S-15: a customer writes to the merchant, a forwarding rule hands payment mail to the agent, and the reply goes back in the same thread.
export default function EmailDemo() {
  const [from, setFrom] = useState('asha.demo@example.test')
  const [subject, setSubject] = useState('Paid but premium not active')
  const [body, setBody] = useState('Hi, I paid Rs 299 for Premium Monthly yesterday but my account still shows the free plan.')
  const [tid, setTid] = useState<string>()
  const [error, setError] = useState<string>()
  const t = useLiveThread(tid)
  const submit = async () => {
    setError(undefined)
    try {
      const step = await send<Schemas['ThreadStep']>('POST', '/api/inbound/email', { customer_ref: from, text: `${subject}\n${body}` })
      setTid(step.thread.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const mails = (t?.messages ?? []).filter((m) => m.direction === 'inbound' || m.policy.status === 'sent')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="xlarge">Email</Heading>
        <Text color="surface.text.gray.muted">The merchant sets one forwarding rule: mail with payment words goes to the agent. Replies go back in the same thread, from the merchant's own domain once it is set up.</Text>
      </Box>
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Sending any text plays the recorded reply.`} />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="Not delivered" description={error} />}
      <Card><CardBody>
        <Box display="flex" flexDirection="column" gap="spacing.4">
          <Text size="small" weight="semibold">Forwarding rule (example)</Text>
          <Text size="small" color="surface.text.gray.muted">If the subject or body has "payment", "paid", "debited", "refund" or "UPI", forward to payments-help. The agent reads only what is forwarded.</Text>
        </Box>
      </CardBody></Card>
      <Box display="flex" flexDirection="column" gap="spacing.4" maxWidth="640px">
        <TextInput label="From" value={from} onChange={({ value }) => setFrom(value ?? '')} />
        <TextInput label="Subject" value={subject} onChange={({ value }) => setSubject(value ?? '')} />
        <TextArea label="Message" value={body} onChange={({ value }) => setBody(value ?? '')} numberOfLines={4} />
        <Box><Button onClick={submit}>Send email</Button></Box>
      </Box>
      {mails.map((m) => (
        <Card key={m.id}><CardBody>
          <Text size="small" color="surface.text.gray.muted">{m.direction === 'inbound' ? `From ${from}` : 'From Kaksha payment help, powered by Razorpay'} · {when(m.created_at)}</Text>
          <Text>{m.body}</Text>
        </CardBody></Card>
      ))}
      {tid && <Link to={`/threads/${tid}`}><Text size="small" color="interactive.text.primary.normal">See it as the founder</Text></Link>}
    </Box>
  )
}
