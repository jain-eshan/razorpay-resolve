import { useEffect, useState } from 'react'
import { Box, Button, RayIcon, Text, TextInput } from '@razorpay/blade/components'
import { isLive, send, type Schemas } from '../lib/api'
import { demoSuggestions } from '../lib/demo'
import { useLiveThread } from '../lib/live'

// What the customer sees: their own messages and the agent's replies that were actually sent. Held drafts and the founder's brief never reach this view.
export function CustomerChat({ channel, who, context, title, onThread, placeholder }: {
  channel: string; who: string; context?: Record<string, unknown>; title: string; onThread?: (id: string) => void; placeholder?: string
}) {
  const [tid, setTid] = useState<string>()
  const [textState, setText] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState<string[]>([])  // the server keeps identifiers as tokens, so the phone shows what was typed
  const t = useLiveThread(tid)
  const [chips, setChips] = useState<string[]>([])  // guided demo: the messages the recorded scenarios understand
  useEffect(() => {
    if (!isLive) demoSuggestions(channel, tid).then(setChips)
  }, [channel, tid, t?.state])
  const inbound = (t?.messages ?? []).filter((m) => m.direction === 'inbound').length  // typed messages are the most recent inbound ones; older ones are shown as stored
  const shown = (t?.messages ?? []).filter((m) => m.direction === 'inbound' || (m.sender_role !== 'system' && m.policy.status === 'sent'))

  const submit = async (override?: string) => {
    const text = override ?? textState
    if (!text.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const step = await send<Schemas['ThreadStep']>('POST', `/api/inbound/${channel}`, { customer_ref: who, text, context: context ?? {} })
      setTid(step.thread.id)
      onThread?.(step.thread.id)
      setTyped((a) => [...a, text])
      setText('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box backgroundColor="surface.background.gray.subtle" borderRadius="xlarge" borderWidth="thin" borderColor="surface.border.gray.normal" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.4" width="100%" testID="customer-chat">
      <Box display="flex" alignItems="center" gap="spacing.3">
        <RayIcon size="large" color="surface.icon.onSea.onSubtle" />
        <Box><Text weight="semibold">{title}</Text><Text size="small" color="surface.text.gray.muted">Simulated. You are the customer.</Text></Box>
      </Box>
      <Box display="flex" flexDirection="column" gap="spacing.3" minHeight="220px">
        {shown.length === 0 && <Text size="small" color="surface.text.gray.muted">{placeholder ?? 'Say what went wrong with your payment.'}</Text>}
        {shown.map((m, i) => (
          <Box key={m.id} alignSelf={m.direction === 'inbound' ? 'flex-end' : 'flex-start'} maxWidth="85%" backgroundColor="surface.background.gray.intense" borderRadius="large" padding="spacing.4">
            <Text size="small">{m.direction === 'inbound' ? (typed[shown.slice(0, i).filter((x) => x.direction === 'inbound').length - (inbound - typed.length)] ?? m.body) : m.body}</Text>
          </Box>
        ))}
      </Box>
      {error && <Text size="small" color="feedback.text.negative.intense">{error}</Text>}
      {isLive ? (
        <Box display="flex" gap="spacing.3" alignItems="flex-end">
          <Box flex="1"><TextInput label="Message" labelPosition="top" value={textState} onChange={({ value }) => setText(value ?? '')} placeholder="Type a message" /></Box>
          <Button isLoading={busy} isDisabled={!textState.trim()} onClick={() => submit()}>Send</Button>
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <Text size="small" color="surface.text.gray.muted">{chips.length ? 'Tap a message to send it:' : 'That conversation is finished. Start another from the left.'}</Text>
          {chips.map((c) => <Button key={c} variant="secondary" size="small" isDisabled={busy} onClick={() => submit(c)}>{c}</Button>)}
        </Box>
      )}
    </Box>
  )
}
