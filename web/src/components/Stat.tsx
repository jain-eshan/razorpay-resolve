import { Box, Card, CardBody, Heading, Text, type IconComponent } from '@razorpay/blade/components'

// A small stat card, like Refunds, Disputes and Failed on the dashboard's payments page. The label and the value stay siblings.
export function Stat({ label, value, hint, icon: Icon, tone = 'neutral' }: { label: string; value: string; hint?: string; icon?: IconComponent; tone?: 'neutral' | 'positive' | 'negative' | 'notice' }) {
  return (
    <Card>
      <CardBody>
        <Box display="flex" gap="spacing.4" alignItems="flex-start">
          {Icon && <Icon size="large" color={tone === 'neutral' ? 'surface.icon.gray.muted' : `feedback.icon.${tone}.intense`} />}
          <Box display="flex" flexDirection="column">
            <Text size="small" weight="semibold" color="surface.text.gray.subtle">{label}</Text>
            <Heading size="large">{value}</Heading>
            {hint && <Text size="small" color="surface.text.gray.muted">{hint}</Text>}
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}
