import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Card, CardBody, CheckCircleIcon, Divider, Heading, Text } from '@razorpay/blade/components'
import { DemoFrame, DemoLoading } from '../components/DemoPath'
import { rupees } from '../lib/api'
import { approve, BRAND, canApprove, clock, minutesBetween, STEPS, useApproved, useJ2 } from '../lib/brand'

// One line of the chat: a square with the sender's initial (no logos), the name and time, then the message.
function Message({ who, at, tone = 'plain', children }: { who: string; at: string; tone?: 'plain' | 'blindspot'; children: ReactNode }) {
  return (
    <Box display="flex" gap="spacing.4" alignItems="flex-start">
      <Box width="40px" height="40px" flexShrink={0} borderRadius="medium" display="flex" alignItems="center" justifyContent="center"
        backgroundColor={tone === 'blindspot' ? 'surface.background.primary.intense' : 'surface.background.gray.moderate'}>
        <Text weight="semibold" color={tone === 'blindspot' ? 'surface.text.staticWhite.normal' : 'surface.text.gray.muted'}>{who[0]}</Text>
      </Box>
      <Box display="flex" flexDirection="column" gap="spacing.2" minWidth="0px" flex="1">
        <Box display="flex" alignItems="baseline" gap="spacing.3" flexWrap="wrap">
          <Text weight="semibold">{who}</Text>
          <Text size="small" color="surface.text.gray.muted">{at}</Text>
        </Box>
        {children}
      </Box>
    </Box>
  )
}

// The RCA in the brand's shared channel with Razorpay (roadmap J5, wireframe 2): the cause, the numbers, the fix, who signed it off, and the actions as buttons in the thread. A
// button changes this tab's state only (lib/brand.ts): nothing is refunded or sent, and the issue page shows the same approvals.
export default function DemoSlack() {
  const { data: j2, error } = useJ2()
  const done = useApproved()
  const nav = useNavigate()
  if (!j2) return <DemoLoading at={2} error={error} />
  const { counts: c, money_paise: m, timeline: t, sentry } = j2
  const lines = [
    `Whose side: your app code. Confidence: exact, ${j2.signals.length} signals agree.`,
    `Started: ${clock(t.rollout)}, with the ${j2.app_version} rollout. Razorpay and banks are working normally.`,
    `Affected: ${c.affected.toLocaleString('en-IN')} customers saw “failed” after paying. ${c.paid_twice} paid twice. ${c.no_order} left with no order.`,
    `Fix: roll back ${j2.app_version}, or patch the verify-payment call. Sample payment IDs attached.`,
  ]
  // The three steps: the amount and the count come before the button, so nobody presses one without them. Every step is always on screen, and its block keeps one size
  // whether it is waiting, ready or approved, so the card does not move under a finger. The message to customers stays disabled until the orders are confirmed.
  const steps = [
    { id: 'refund', button: `Refund ${c.paid_twice} duplicates`, hint: `${rupees(m.paid_twice)} back to the original payment methods` },
    { id: 'orders', button: `Send ${c.no_order} order list`, hint: `${rupees(m.no_order)} paid with no order` },
    { id: 'message', button: `Message ${c.no_order} customers`, hint: 'Your payment went through, your order is confirmed. Sent after the orders are confirmed.' },
  ] as const

  return (
    <DemoFrame at={2} primary={done.length === STEPS.length} guide={`${minutesBetween(t.alert, t.rca)} minutes after the alert the RCA is in the channel, signed off ${minutesBetween(t.rca, t.signoff)} minute later. Approve the actions in the thread.`}>
      <Card testID="slack-channel">
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.5">
            <Box display="flex" justifyContent="space-between" alignItems="center" gap="spacing.4" flexWrap="wrap">
              <Heading as="h1" size="medium">{`# ${BRAND.toLowerCase()}-razorpay-payments`}</Heading>
              <Badge color="neutral" size="medium">Shared with Razorpay</Badge>
            </Box>
            <Divider />

            <Message who="Sentry" at={clock(t.alert)}>
              <Text>{`${sentry.issue} on ${sentry.service}: ${sentry.events} events in ${sentry.window_minutes} minutes`}</Text>
            </Message>

            <Message who="Razorpay Blindspot" at={clock(t.rca)} tone="blindspot">
              <Box borderLeftWidth="thicker" borderLeftColor="surface.border.primary.normal" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.subtle" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.3" testID="slack-rca">
                <Text weight="semibold">{`RCA: ${j2.platform} app ${j2.app_version} shows “Payment failed” after successful UPI payments`}</Text>
                {lines.map((l) => <Text key={l}>{l}</Text>)}
                <Text size="small" color="surface.text.gray.muted">{`Sample payments: ${j2.sample_payment_ids.slice(0, 3).join(', ')}`}</Text>
                <Text size="small" color="surface.text.gray.muted">{`Signed off by Razorpay support at ${clock(t.signoff)}`}</Text>
                {steps.map((st) => (
                  <Box key={st.id} display="flex" flexDirection="column" gap="spacing.2" alignItems="flex-start" testID={`slack-step-${st.id}`}>
                    <Text size="small" color="surface.text.gray.muted">{st.hint}</Text>
                    <Box display="flex" alignItems="center" minHeight="36px">
                      {done.includes(st.id)
                        ? <Badge color="positive" size="large" icon={CheckCircleIcon}>Approved by you</Badge>
                        : <Button variant="secondary" size="medium" isDisabled={!canApprove(st.id, done)} onClick={() => approve(st.id)}>{st.button}</Button>}
                    </Box>
                  </Box>
                ))}
                <Box display="flex" alignItems="center" minHeight="36px"><Button variant="secondary" size="medium" onClick={() => nav('/demo/incident')}>Open evidence</Button></Box>
                <Text size="small" color="surface.text.gray.muted">Demo: approving here changes this demo only. No refund is made and no message is sent.</Text>
              </Box>
            </Message>

            <Message who="On-call engineer" at={clock(t.rollback)}>
              <Text>{`Rolling back ${j2.app_version} now.`}</Text>
            </Message>
          </Box>
        </CardBody>
      </Card>
    </DemoFrame>
  )
}
