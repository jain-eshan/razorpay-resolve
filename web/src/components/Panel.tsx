import type { ReactNode } from 'react'
import { Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'

// A card with the dashboard's grey header band (the "Details" card on a payment page): title on the left, a tag or action on the right.
export function Panel({ title, subtitle, trailing, children, pad = true }: { title: string; subtitle?: string; trailing?: ReactNode; children?: ReactNode; pad?: boolean }) {
  return (
    <Card padding="spacing.0">
      <CardBody>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing.4" paddingX="spacing.6" paddingY="spacing.5" backgroundColor="surface.background.gray.subtle"
        borderTopLeftRadius="medium" borderTopRightRadius="medium" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
        <Box display="flex" flexDirection="column">
          <Heading size="small">{title}</Heading>
          {subtitle && <Text size="small" color="surface.text.gray.muted">{subtitle}</Text>}
        </Box>
        {trailing}
      </Box>
      {children !== undefined && <Box padding={pad ? 'spacing.6' : 'spacing.0'} display="flex" flexDirection="column" gap="spacing.4">{children}</Box>}
      </CardBody>
    </Card>
  )
}
