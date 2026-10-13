import { Box, Card, CardBody, Heading, Text, type IconComponent } from '@razorpay/blade/components'

// A small stat card, like Refunds, Disputes and Failed on the dashboard's payments page. The label and the value stay siblings.
// It fills its grid cell, so a row of stats is one height even when one hint wraps.
// Only the figure is bold. The label is regular and muted, as the dashboard's own stat cards are: a row of eight bold labels read as a wall of text (Eshan, 13 Oct).
export function Stat({ label, value, hint, icon: Icon, tone = 'neutral' }: { label: string; value: string; hint?: string; icon?: IconComponent; tone?: 'neutral' | 'positive' | 'negative' | 'notice' }) {
  return (
    <Card height="100%">
      <CardBody>
        <Box display="flex" gap="spacing.4" alignItems="flex-start">
          {Icon && <Box flexShrink={0} display="flex"><Icon size="large" color={tone === 'neutral' ? 'surface.icon.gray.muted' : `feedback.icon.${tone}.intense`} /></Box>}
          <Box display="flex" flexDirection="column">
            <Text size="small" color="surface.text.gray.muted">{label}</Text>
            <Heading as="h2" size="large">{value}</Heading>
            {hint && <Text size="small" color="surface.text.gray.muted">{hint}</Text>}
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}
