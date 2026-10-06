import { useState } from 'react'
import { Alert, Box, Heading, Text } from '@razorpay/blade/components'
import { CustomerChat } from '../components/CustomerChat'
import { ThreadView } from '../components/ThreadView'
import { isLive } from '../lib/api'
import { demoNote } from '../lib/demo'
import { useLiveThread } from '../lib/live'

// S-14: the customer's WhatsApp on the left, the founder's live view of the same thread on the right.
export default function ChatDemo() {
  const [tid, setTid] = useState<string>()
  const [v, setV] = useState(0)
  const t = useLiveThread(tid, v)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="xlarge">WhatsApp, both sides</Heading>
        <Text color="surface.text.gray.muted">Write as a customer. Try a message with no reference first, then give one. Try an unrelated message, or one that tries to give the agent instructions.</Text>
      </Box>
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Pick a message below. The founder's view on the right is the same screen the live version uses.`} />}
      {(
        <Box display="flex" gap="spacing.7" flexWrap="wrap" alignItems="flex-start">
          <CustomerChat channel="whatsapp_payments" who="+919800012345" title="Kaksha payment help" onThread={setTid} />
          <Box flex="1" minWidth="320px">
            {t ? <ThreadView thread={t} onChanged={() => setV((n) => n + 1)} /> : <Text color="surface.text.gray.muted">The founder's view appears when the customer writes.</Text>}
          </Box>
        </Box>
      )}
    </Box>
  )
}
