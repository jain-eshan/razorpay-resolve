import { useEffect, useState } from 'react'
import { AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, Divider, Heading, Spinner, Switch, Text } from '@razorpay/blade/components'
import { DemoFrame, DemoLoading } from '../components/DemoPath'
import { rupees } from '../lib/api'
import { BRAND, useJ2 } from '../lib/brand'

type Phase = 'cart' | 'paying' | 'paid' | 'failed'

// Row of "what is really going on", behind the screen: what Razorpay did, what the brand's server did, what the customer was told.
const Fact = ({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' | 'neutral' }) => (
  <Box display="flex" justifyContent="space-between" alignItems="center" gap="spacing.4" flexWrap="wrap">
    <Text color="surface.text.gray.muted">{label}</Text>
    <Badge color={tone} size="medium">{value}</Badge>
  </Box>
)

// The one screen of the store the story needs (roadmap J3): the result of a UPI payment. A switch beside it, outside the store's own screen, ships app 8.2. With it on, the payment
// still goes through at Razorpay, but the app never asks the server to verify it, so the customer is told it failed. A second try is a second charge: that is how some customers paid twice.
export default function DemoStore() {
  const { data: j2, error } = useJ2()
  const [bug, setBug] = useState(false)
  const [phase, setPhase] = useState<Phase>('cart')
  const [charges, setCharges] = useState(0)
  const [lastBug, setLastBug] = useState(false)
  const [retried, setRetried] = useState(false)  // the customer saw "failed" and pressed Try again: the next payment is the second one for the same order
  useEffect(() => {
    if (phase !== 'paying') return
    const t = setTimeout(() => setPhase(lastBug ? 'failed' : 'paid'), 1200)
    return () => clearTimeout(t)
  }, [phase, lastBug])
  if (!j2) return <DemoLoading at={0} error={error} />
  const price = rupees(j2.customers[0].amount_paise)
  const version = bug ? j2.app_version : j2.previous_version
  const shown = phase === 'paid' || phase === 'failed'

  return (
    <DemoFrame at={0} primary={shown} guide={`Switch on app ${j2.app_version}, then pay. The app says “Payment failed”, but Razorpay has the money.`}>
      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'minmax(0, 420px) minmax(0, 1fr)' }} gap="spacing.6" alignItems="stretch">
        {/* The store's own screen: a phone-sized card, generic, with the brand's name in text. */}
        <Card testID="store-screen" height="100%">
          <CardBody>
            <Box display="flex" flexDirection="column" gap="spacing.5" minHeight="360px">
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Heading as="h1" size="medium">{BRAND}</Heading>
                <Badge color="neutral" size="medium">Demo store</Badge>
              </Box>
              <Box borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle" />
              {phase === 'cart' && (
                <>
                  <Box display="flex" justifyContent="space-between" gap="spacing.4">
                    <Box display="flex" flexDirection="column">
                      <Text weight="semibold">Wireless earbuds</Text>
                      <Text size="small" color="surface.text.gray.muted">1 item</Text>
                    </Box>
                    <Text weight="semibold">{price}</Text>
                  </Box>
                  <Box display="flex" justifyContent="space-between" gap="spacing.4">
                    <Text color="surface.text.gray.muted">Pay with</Text>
                    <Text>UPI</Text>
                  </Box>
                  <Box marginTop="auto">
                    <Button variant="primary" size="large" isFullWidth onClick={() => { setLastBug(bug); setCharges((n) => n + 1); setPhase('paying') }}>{`Pay ${price}`}</Button>
                  </Box>
                </>
              )}
              {phase === 'paying' && (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="spacing.4" flex="1">
                  <Spinner accessibilityLabel="Waiting for your UPI app" size="large" />
                  <Text>Approve the payment in your UPI app</Text>
                </Box>
              )}
              {phase === 'paid' && (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="spacing.3" flex="1" textAlign="center">
                  <CheckCircleIcon size="2xlarge" color="feedback.icon.positive.intense" />
                  <Heading size="medium">Payment successful</Heading>
                  <Text color="surface.text.gray.muted">Your order is confirmed.</Text>
                  <Button variant="secondary" size="medium" onClick={() => { setRetried(false); setPhase('cart') }}>Back to the store</Button>
                </Box>
              )}
              {phase === 'failed' && (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="spacing.3" flex="1" textAlign="center">
                  <AlertTriangleIcon size="2xlarge" color="feedback.icon.negative.intense" />
                  <Heading size="medium">Payment failed</Heading>
                  <Text color="surface.text.gray.muted">Something went wrong. Please try again.</Text>
                  <Button variant="secondary" size="medium" onClick={() => { setRetried(true); setPhase('cart') }}>Try again</Button>
                </Box>
              )}
            </Box>
          </CardBody>
        </Card>

        {/* Behind the screen: not part of the store. The switch, and what Razorpay, the server and the app each did. */}
        <Card testID="behind-the-screen" height="100%">
          <CardBody>
            <Box display="flex" flexDirection="column" gap="spacing.5">
              <Heading as="h2" size="small">Behind the screen</Heading>
              <Box display="flex" justifyContent="space-between" alignItems="center" gap="spacing.4">
                <Box display="flex" flexDirection="column">
                  <Text weight="semibold">{`Ship app ${j2.app_version}`}</Text>
                  <Text size="small" color="surface.text.gray.muted">{`The ${j2.platform} app skips the verify-payment call after UPI`}</Text>
                </Box>
                <Switch accessibilityLabel={`Ship app ${j2.app_version}`} isChecked={bug} onChange={({ isChecked }) => setBug(isChecked)} />
              </Box>
              <Divider />
              <Fact label="App version" value={`${j2.platform} ${version}`} tone="neutral" />
              {/* The three facts are always there, so the card keeps its size: before a payment they say so, and the note keeps two lines of room. */}
              <Fact label="Razorpay" value={!shown ? 'No payment yet' : charges > 1 ? `Captured ${charges} payments` : 'Payment captured'} tone={shown ? 'positive' : 'neutral'} />
              <Fact label={`${BRAND} server`} value={!shown ? 'No payment yet' : lastBug ? 'Never asked to verify' : 'Verified the payment'} tone={!shown ? 'neutral' : lastBug ? 'negative' : 'positive'} />
              <Fact label="The customer saw" value={!shown ? 'No payment yet' : lastBug ? 'Payment failed' : 'Payment successful'} tone={!shown ? 'neutral' : lastBug ? 'negative' : 'positive'} />
              <Box minHeight="40px">
                <Text size="small" color="surface.text.gray.muted">
                  {lastBug && retried && shown ? `Paying again is a second charge. This is how ${j2.counts.paid_twice} customers paid twice.` : 'If the customer pays again after “failed”, that is a second charge.'}
                </Text>
              </Box>
            </Box>
          </CardBody>
        </Card>
      </Box>
    </DemoFrame>
  )
}
