import { useState } from 'react'
import { Alert, Badge, Box, Heading, Text } from '@razorpay/blade/components'
import { CustomerChat } from '../components/CustomerChat'
import { ThreadView } from '../components/ThreadView'
import { isLive, type Schemas } from '../lib/api'
import { demoNote } from '../lib/demo'
import { useLiveThread } from '../lib/live'

// Who has the thread right now, read from the lines the system wrote into it.
function control(t?: Schemas['ThreadDetail']): [string, 'positive' | 'neutral' | 'notice'] {
  const last = [...(t?.messages ?? [])].reverse().find((m) => m.sender_role === 'system' && ['pass', 'release', 'stayed'].includes(String(m.policy.kind)))
  const k = String(last?.policy.kind ?? '')
  return k === 'pass' ? ['Blindspot has control', 'positive'] : k === 'release' ? ['Back with the Meta inbox', 'notice'] : k === 'stayed' ? ['Stayed with the Meta inbox', 'neutral'] : ['The Meta inbox has it', 'neutral']
}

// S-16: Instagram, the way Meta's handover protocol works. The merchant's Meta inbox keeps everything that is not about a payment, passes the rest to Blindspot, and takes the thread back when it is over or a person is needed.
export default function IgDemo() {
  const [tid, setTid] = useState<string>()
  const [v, setV] = useState(0)
  const t = useLiveThread(tid, v)
  const [label, tone] = control(t)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="xlarge">Instagram: control passes and returns</Heading>
        <Text color="surface.text.gray.muted">
          The merchant's Meta inbox stays in charge of every Instagram conversation. When a message is about a payment it passes the thread to Blindspot, and it takes the thread back when the conversation is over or a person is needed. A message that is not about a payment never leaves the inbox, and Blindspot says nothing and keeps nothing.
        </Text>
      </Box>
      <Alert isFullWidth color="information" isDismissible={false} title="Meta's window rules apply"
        description="Blindspot can reply for 24 hours after the customer's last message. After that only a person can reply, with Meta's Human Agent tag, for up to 7 days. Blindspot never uses that tag." />
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Pick a message below. The founder's view on the right is the same screen the live version uses.`} />}
      <Box display="flex" gap="spacing.7" flexWrap="wrap" alignItems="flex-start">
        <CustomerChat channel="ig_dm" who="igsid_demo_a" title="kaksha on Instagram" onThread={setTid} placeholder="Send the merchant a direct message." />
        <Box flex="1" minWidth="320px" display="flex" flexDirection="column" gap="spacing.4">
          <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
            <Text weight="semibold">Control of this thread:</Text>
            <Badge color={tone} size="medium">{label}</Badge>
          </Box>
          {t ? <ThreadView thread={t} onChanged={() => setV((n) => n + 1)} /> : <Text color="surface.text.gray.muted">The founder's view appears when the customer writes.</Text>}
        </Box>
      </Box>
    </Box>
  )
}
