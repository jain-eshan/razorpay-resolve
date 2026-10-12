import type { ReactNode } from 'react'
import { Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'

// A card with the dashboard's grey header band (the "Details" card on a payment page): title on the left, a tag or action on the right.
// `fill`: the body grows to the card's height (the card stretches to its grid row), so a footer can sit at the bottom and an empty state can centre. Without it the
// card is as tall as its content, as before.
export function Panel({ title, subtitle, trailing, children, pad = true, fill = false }: { title: string; subtitle?: string; trailing?: ReactNode; children?: ReactNode; pad?: boolean; fill?: boolean }) {
  return (
    <Card padding="spacing.0" height="100%">
      <CardBody height={fill ? '100%' : undefined}>
        {/* In fill mode the header and the body sit in a column as tall as the card, so the body can take what is left. Blade's Card accepts only its own parts as children, hence CardBody at full height and this column inside it. */}
        <Box display={fill ? 'flex' : 'block'} flexDirection="column" height={fill ? '100%' : undefined}>
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
      {children !== undefined && <Box padding={pad ? 'spacing.6' : 'spacing.0'} display="flex" flexDirection="column" gap="spacing.4" flexGrow={fill ? '1' : undefined} minHeight={fill ? 'spacing.0' : undefined}>{children}</Box>}
        </Box>
      </CardBody>
    </Card>
  )
}
