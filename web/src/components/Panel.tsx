import type { ReactNode } from 'react'
import { Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'

// A card with the dashboard's grey header band (the "Details" card on a payment page): title on the left, a tag or action on the right.
export function Panel({ title, subtitle, trailing, children, pad = true }: { title: string; subtitle?: string; trailing?: ReactNode; children?: ReactNode; pad?: boolean }) {
  return (
    <Card padding="spacing.0" height="100%">
      <CardBody>
      <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="spacing.4" paddingX="spacing.6" paddingY="spacing.5" backgroundColor="surface.background.gray.subtle"
        borderRadius="medium" borderBottomLeftRadius={children === undefined ? 'medium' : 'none'} borderBottomRightRadius={children === undefined ? 'medium' : 'none'}
        borderWidth="thin" borderColor="surface.border.gray.subtle">
        <Box display="flex" flexDirection="column">
          <Heading as="h2" size="small">{title}</Heading>
          {subtitle && <Text size="small" color="surface.text.gray.muted">{subtitle}</Text>}
        </Box>
        {/* The tag on the right keeps its size (a "3 found" badge was cut to "3..." at 375px); a long note wraps under the title instead. */}
        {trailing && <Box flexShrink={0} maxWidth="100%">{trailing}</Box>}
      </Box>
      {children !== undefined && <Box padding={pad ? 'spacing.6' : 'spacing.0'} display="flex" flexDirection="column" gap="spacing.4">{children}</Box>}
      </CardBody>
    </Card>
  )
}
