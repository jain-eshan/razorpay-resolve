import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Box, Button, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { CustomerChat } from '../components/CustomerChat'
import { isLive, rupees, useGet, type Schemas } from '../lib/api'
import { demoHelpPayment, demoNote } from '../lib/demo'

const SURFACES: Record<string, { title: string; body: string }> = {
  'checkout-error': { title: 'Your payment may not have gone through', body: 'We could not confirm this payment with your bank. If money left your account it is usually returned within a few days.' },
  'link-page': { title: 'Pay Kaksha', body: 'Premium Monthly. You will be taken to a secure Razorpay page to pay.' },
  receipt: { title: 'Payment received', body: 'Thanks. Razorpay has received your payment and sent it to Kaksha.' },
}

// S-13: the "Need help with this payment?" button on pages Razorpay owns (simulated). The page already knows the payment, so the customer is not asked for it.
export default function HelpDemo() {
  const { surface = 'receipt' } = useParams()
  const s = SURFACES[surface] ?? SURFACES.receipt
  const { data: members } = useGet<Schemas['Member'][]>('/api/incidents/INC-1/members')
  const [demoPay, setDemoPay] = useState<string>()
  useEffect(() => {
    if (!isLive) demoHelpPayment().then(setDemoPay)
  }, [])
  const [open, setOpen] = useState(false)
  const [tid, setTid] = useState<string>()
  const pay = isLive ? (members?.find((m) => m.tier === 'exact' && !m.complained) ?? members?.[0]) : members?.find((m) => m.payment_id === demoPay)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" alignItems="center">
      <Box display="flex" gap="spacing.5" flexWrap="wrap">
        {Object.keys(SURFACES).map((k) => <Link key={k} to={`/help-demo/${k}`} style={{ textDecoration: 'none', fontWeight: k === surface ? 600 : 400 }}><Text color="interactive.text.primary.normal">{k.replace('-', ' ')}</Text></Link>)}
      </Box>
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={demoNote} />}
      <Card><CardBody>
        <Box display="flex" flexDirection="column" gap="spacing.4" maxWidth="420px">
          <Text size="small" color="surface.text.gray.muted">razorpay · simulated page</Text>
          <Heading size="large">{s.title}</Heading>
          <Text>{s.body}</Text>
          {pay && <Text size="small" color="surface.text.gray.muted">{pay.plan} · {rupees(pay.amount_paise)} · {pay.payment_id}</Text>}
          {pay && <Box><Button variant="secondary" onClick={() => setOpen(true)}>Need help with this payment?</Button></Box>}
        </Box>
      </CardBody></Card>
      {open && pay && (
        <Box display="flex" flexDirection="column" gap="spacing.4" alignItems="center">
          <CustomerChat channel="help_button" who="+919800012399" title="Kaksha payment help" context={{ payment_id: pay.payment_id, surface }} onThread={setTid} placeholder="You do not need to look anything up. This page already knows the payment." />
          {tid && <Link to={`/threads/${tid}`}><Text size="small" color="interactive.text.primary.normal">See it as the founder</Text></Link>}
        </Box>
      )}
    </Box>
  )
}
