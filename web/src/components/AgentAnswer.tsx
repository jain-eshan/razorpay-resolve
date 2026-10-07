import type { ReactNode } from 'react'
import { Box, Button, Heading, RayIcon, Text } from '@razorpay/blade/components'

// How Razorpay's agents answer (Payout, Receivables, Bookkeeping agents; web/DESIGN.md section 17): a bold title that leads with the number,
// one muted line saying what was analysed, the evidence as cards, then "How can I help you next?" with numbered next steps.
export function AgentAnswer({ title, text, children, next }: { title: ReactNode; text: string; children: ReactNode; next?: { label: string; onClick: () => void }[] }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="agent-answer">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="medium">{title}</Heading>
        <Text color="surface.text.gray.muted">{text}</Text>
      </Box>
      {children}
      {next && next.length > 0 && (
        <Box display="flex" flexDirection="column" gap="spacing.3" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" paddingTop="spacing.5">
          <Box display="flex" alignItems="center" gap="spacing.3"><RayIcon size="medium" color="surface.icon.onSea.onSubtle" /><Text weight="semibold">How can I help you next?</Text></Box>
          <Box display="flex" flexDirection="column" alignItems="flex-start" gap="spacing.2">
            {next.map((n, i) => <Button key={n.label} variant="tertiary" size="medium" onClick={n.onClick}>{`${i + 1}. ${n.label}`}</Button>)}
          </Box>
        </Box>
      )}
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
