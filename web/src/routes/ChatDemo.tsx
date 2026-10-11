import { Crumbs } from '../components/Crumbs'
import { useState } from 'react'
import { Alert, Box, Card, CardBody, EmptyState } from '@razorpay/blade/components'
import { GuideArt } from '../components/GuideArt'
import { CustomerChat } from '../components/CustomerChat'
import { ThreadView } from '../components/ThreadView'
import { isLive } from '../lib/api'
import { demoNote } from '../lib/demo'
import { useLiveThread } from '../lib/live'
import { PageHeader } from '../components/PageHeader'

// S-14: the customer's WhatsApp on the left, the founder's live view of the same thread on the right.
export default function ChatDemo() {
  const [tid, setTid] = useState<string>()
  const [v, setV] = useState(0)
  const t = useLiveThread(tid, v)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Crumbs items={[{ label: 'Customer complaints', to: '/threads' }, { label: 'Try it: WhatsApp', to: '/chat-demo' }]} />
      <PageHeader title="WhatsApp, both sides" description="Write as a customer. Try a message with no reference first, then give one. Try an unrelated message, or one that tries to give the agent instructions." />
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Demo" description={`${demoNote} Pick a message below. Your view on the right is the same screen the live version uses.`} />}
      {(
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'minmax(320px, 400px) minmax(0, 1fr)' }} gap="spacing.7" alignItems="start">
          <CustomerChat channel="whatsapp_payments" who="+919800012345" title="Kaksha payment help" onThread={setTid} />
          <Box minWidth="0px">
            {t ? <ThreadView thread={t} onChanged={() => setV((n) => n + 1)} /> : (
              // Holds the founder's side of the page from the start, so the layout does not sit half empty until the first message.
              <Card><CardBody>
                <EmptyState size="large" asset={<Box width="120px"><GuideArt art="handover" height="80px" /></Box>} title="Your view appears here"
                  description="Tap a message on the left. Here you see what you see: the payment the agent found, what your records show, and any reply waiting for approval." />
              </CardBody></Card>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}
