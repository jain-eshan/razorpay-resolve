import { useEffect, useState, type ReactNode } from 'react'
import { Box, Button, RayIcon, Text, TextInput } from '@razorpay/blade/components'
import { isLive, send, type Schemas } from '../lib/api'
import { demoSuggestions } from '../lib/demo'
import { useLiveThread } from '../lib/live'
import { waTime } from '../lib/whatsapp'
import { WhatsAppChat } from './WhatsAppChat'

// What the customer sees: their own messages and the agent's replies that were actually sent. Held drafts and the founder's brief never reach this view.
// `bare` drops the grey frame and the header, for a page that puts the chat in its own card. `controls` replaces the suggested-message buttons of the hosted demo
// with the page's own, above and below the phone; it gets the send function, which resolves to the conversation's id.
export function CustomerChat({ channel, who, context, title, onThread, placeholder, bare = false, controls }: {
  channel: string; who: string; context?: Record<string, unknown>; title: string; onThread?: (id: string) => void; placeholder?: string; bare?: boolean
  controls?: (send: (text: string) => Promise<string | undefined>, busy: boolean) => { above?: ReactNode; below?: ReactNode }
}) {
  const [tid, setTid] = useState<string>()
  const [textState, setText] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  // The server keeps identifiers as tokens, so the phone shows what was typed. Kept per conversation: the demo moves between conversations, and one list mixed them up.
  const [typedBy, setTyped] = useState<Record<string, string[]>>({})
  const t = useLiveThread(tid)
  const [chips, setChips] = useState<string[]>([])  // guided demo: the messages the recorded scenarios understand
  useEffect(() => {
    if (!isLive) demoSuggestions(channel, tid).then(setChips)
  }, [channel, tid, t?.state])
  const inbound = (t?.messages ?? []).filter((m) => m.direction === 'inbound').length  // typed messages are the most recent inbound ones; older ones are shown as stored
  const shown = (t?.messages ?? []).filter((m) => m.direction === 'inbound' || (m.sender_role !== 'system' && m.policy.status === 'sent'))
  const typed = (tid && typedBy[tid]) || []
  // A message that is not about a payment is not kept by the server, but the customer still sees what they sent on their own phone.
  const unkept = Math.max(0, typed.length - inbound)

  const submit = async (override?: string): Promise<string | undefined> => {
    const text = override ?? textState
    if (!text.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const step = await send<Schemas['ThreadStep']>('POST', `/api/inbound/${channel}`, { customer_ref: who, text, context: context ?? {} })
      const id = step.thread.id
      // As many typed messages as the conversation now holds (at least this one): a conversation that starts again keeps only its new first message.
      const kept = Math.max(1, step.thread.messages.filter((m) => m.direction === 'inbound').length)
      setTyped((a) => ({ ...a, [id]: [...(a[id] ?? []), text].slice(-kept) }))
      setTid(id)
      onThread?.(id)
      setText('')
      return id
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const own = !isLive && controls ? controls(submit, busy) : undefined
  return (
    <Box {...(bare ? {} : { backgroundColor: 'surface.background.gray.subtle', borderRadius: 'xlarge', borderWidth: 'thin', borderColor: 'surface.border.gray.normal', padding: 'spacing.5' } as const)} display="flex" flexDirection="column" gap="spacing.4" width="100%" testID="customer-chat">
      {!bare && <Box display="flex" alignItems="center" gap="spacing.3">
        <RayIcon size="large" color="surface.icon.onSea.onSubtle" />
        <Box><Text weight="semibold">{title}</Text><Text size="small" color="surface.text.gray.muted">You are the customer.</Text></Box>
      </Box>}
      {own?.above}
      {(() => {
        const body = (m: (typeof shown)[number], i: number) => (m.direction === 'inbound' ? (typed[unkept + shown.slice(0, i).filter((x) => x.direction === 'inbound').length - Math.max(0, inbound - typed.length)] ?? m.body) : m.body)
        return channel.startsWith('whatsapp') ? (
          <Box display="flex" justifyContent="center">
            <WhatsAppChat name={title} minHeight={220} messages={[
              ...typed.slice(0, unkept).map((text) => ({ from: 'customer' as const, text, time: waTime(t?.last_inbound_at ?? undefined), read: true })),
              ...shown.map((m, i) => ({ from: m.direction === 'inbound' ? 'customer' as const : 'business' as const, text: body(m, i), time: waTime(m.created_at), read: true })),
            ]} />
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.3" minHeight="220px">
            {shown.length === 0 && <Text size="small" color="surface.text.gray.muted">{placeholder ?? 'Say what went wrong with your payment.'}</Text>}
            {shown.map((m, i) => (
              <Box key={m.id} alignSelf={m.direction === 'inbound' ? 'flex-end' : 'flex-start'} maxWidth="85%" backgroundColor="surface.background.gray.intense" borderRadius="large" padding="spacing.4">
                <Text size="small">{body(m, i)}</Text>
              </Box>
            ))}
          </Box>
        )
      })()}
      {channel.startsWith('whatsapp') && shown.length === 0 && !controls && <Text size="small" color="surface.text.gray.muted">{placeholder ?? 'Say what went wrong with your payment.'}</Text>}
      {error && <Text size="small" color="feedback.text.negative.intense">{error}</Text>}
      {isLive ? (
        <Box display="flex" gap="spacing.3" alignItems="flex-end">
          <Box flex="1"><TextInput label="Message" labelPosition="top" value={textState} onChange={({ value }) => setText(value ?? '')} placeholder="Type a message" /></Box>
          <Button isLoading={busy} isDisabled={!textState.trim()} onClick={() => submit()}>Send</Button>
        </Box>
      ) : own ? own.below : (
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <Text size="small" color="surface.text.gray.muted">{chips.length ? 'Tap a message to send it:' : 'That conversation is finished. Start another from the left.'}</Text>
          {chips.map((c) => <Button key={c} variant="secondary" size="small" isDisabled={busy} onClick={() => submit(c)}>{c}</Button>)}
        </Box>
      )}
    </Box>
  )
}
