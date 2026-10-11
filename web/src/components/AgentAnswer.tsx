import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import { Badge, Box, Button, Card, CardBody, CheckIcon, Heading, RayIcon, Text } from '@razorpay/blade/components'
import { prefersReducedMotion } from '../razorsense'

// How Razorpay's agents answer (Payout, Receivables, Bookkeeping agents; web/DESIGN.md section 17): a bold title that leads with the number,
// one muted line saying what was analysed, the evidence as cards, then "How can I help you next?" with numbered next steps.
export function AgentAnswer({ title, text, children, next }: { title: ReactNode; text: string; children: ReactNode; next?: { label: string; onClick: () => void }[] }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="agent-answer">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading as="h2" size="medium">{title}</Heading>
        <Text color="surface.text.gray.muted">{text}</Text>
      </Box>
      {children}
      {next && <NextSteps next={next} />}
    </Box>
  )
}

// The small-caps label above an amount or a block of details: AMOUNT, BANK DETAILS.
export function Label({ children }: { children: ReactNode }) {
  return <Text size="xsmall" weight="semibold" color="surface.text.gray.muted">{String(children).toUpperCase()}</Text>
}

// A divider with a centred label, like "URGENT · OVERDUE >14 DAYS" in the Receivables agent.
export function Divider({ children, tone = 'notice' }: { children: string; tone?: 'notice' | 'negative' | 'positive' }) {
  return (
    <Box display="flex" alignItems="center" gap="spacing.4">
      <Box flex="1" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" />
      <Text size="small" weight="semibold" color={`feedback.text.${tone}.intense`}>{children.toUpperCase()}</Text>
      <Box flex="1" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" />
    </Box>
  )
}

type Next = { label: string; onClick: () => void }[]

// "How can I help you next?" with numbered options. Ends every answer that has somewhere to go.
export function NextSteps({ next }: { next: Next }) {
  if (next.length === 0) return null
  return (
    <Box display="flex" flexDirection="column" gap="spacing.3" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" paddingTop="spacing.5">
      <Box display="flex" alignItems="center" gap="spacing.3"><RayIcon size="medium" color="surface.icon.onSea.onSubtle" /><Text weight="semibold">How can I help you next?</Text></Box>
      <Box display="flex" flexDirection="column" alignItems="flex-start" gap="spacing.2">
        {next.map((n, i) => <Button key={n.label} variant="tertiary" size="medium" onClick={n.onClick}>{`${i + 1}. ${n.label}`}</Button>)}
      </Box>
    </Box>
  )
}

// What the merchant chose, as their own message: white, right-aligned. Every button press that starts something is echoed like this.
export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <Box alignSelf="flex-end" maxWidth="85%" backgroundColor="surface.background.gray.intense" borderRadius="large" borderWidth="thin" borderColor="surface.border.gray.subtle" paddingX="spacing.6" paddingY="spacing.4">
      <Text>{children}</Text>
    </Box>
  )
}

// Shown while the agent works, in place of a spinner: the Ray glyph in AI green and one word.
// The Ray glyph turns a quarter, pauses, and turns again (DESIGN.md section 8: 480ms, emphasized easing). Still for people who ask for less motion.
export function Analyzing() {
  const glyph = <RayIcon size="medium" color="surface.icon.onSea.onSubtle" />
  return (
    <Box display="flex" alignItems="center" gap="spacing.3" testID="analyzing">
      {prefersReducedMotion ? glyph : <m.div animate={{ rotate: 90 }} transition={{ duration: 0.48, ease: [0.5, 0, 0, 1], repeat: Infinity, repeatDelay: 0.48 }} style={{ display: 'flex' }}>{glyph}</m.div>}
      <Text color="surface.text.gray.muted">Analyzing</Text>
    </Box>
  )
}

// One round of a fix flow: the merchant's message (once they have acted), then the agent's step as a titled card. `analyzing` shows the working state above the card.
export function Turn({ n, title, badge, you, analyzing, children }: { n: number; title: string; badge?: [string, 'positive' | 'notice' | 'neutral' | 'negative']; you?: ReactNode; analyzing?: boolean; children: ReactNode }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      {you && <UserBubble>{you}</UserBubble>}
      {analyzing && <Analyzing />}
      <Box display="flex" flexDirection="column" gap="spacing.3">
        <Box display="flex" justifyContent="space-between" alignItems="center" gap="spacing.4">
          <Box display="flex" flexDirection="column"><Label>{`Step ${n}`}</Label><Heading as="h3" size="small">{title}</Heading></Box>
          {badge && <Badge color={badge[1]} size="medium">{badge[0]}</Badge>}
        </Box>
        <Card><CardBody><Box display="flex" flexDirection="column" gap="spacing.4">{children}</Box></CardBody></Card>
      </Box>
    </Box>
  )
}

// What a button becomes once it has been pressed and done its job: a solid green pill with a tick, in the place the button was. It is not a button.
export function Approved({ children }: { children: ReactNode }) {
  return (
    <Box alignSelf="flex-start" display="inline-flex" alignItems="center" gap="spacing.3" height="36px" paddingX="spacing.5" borderRadius="medium" backgroundColor="feedback.background.positive.intense" testID="approved">
      <CheckIcon size="small" color="surface.icon.staticWhite.normal" />
      <Text size="medium" weight="semibold" color="surface.text.staticWhite.normal">{children}</Text>
    </Box>
  )
}
