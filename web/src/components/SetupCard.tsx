import { Badge, Box, Button, Card, CardBody, CheckCircleIcon, Heading, Text } from '@razorpay/blade/components'
import { SETUP_STEP_HELP, SETUP_STEP_NAMES, SETUP_STEPS } from '../lib/setup'

// The three setup steps on the Overview, in the shape of Razorpay's "Get started" strip: a stepper across the top, each step's name and one line under it.
// Blade's horizontal StepGroup centres every label under its dot, which leaves the left edge empty and the heading out of line with the steps, so this
// stepper is left-aligned and built from Blade boxes. Done steps carry a green tick, the current step a blue ring, later steps a grey one.
export function SetupCard({ done, onStart }: { done: number; onStart: () => void }) {
  return (
    <Card testID="setup-card">
      <CardBody>
        <Box display="flex" flexDirection="column" gap="spacing.5">
          <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="spacing.4">
            <Box display="flex" flexDirection="column" gap="spacing.2">
              <Box display="flex" alignItems="center" gap="spacing.4" flexWrap="wrap">
                <Heading as="h2" size="medium">Set up Blindspot</Heading>
                <Badge size="medium" color="neutral">{`${done}/${SETUP_STEPS} COMPLETED`}</Badge>
              </Box>
              <Text color="surface.text.gray.muted">Three steps. Nothing changes until you approve it.</Text>
            </Box>
            <Button variant="primary" size="medium" onClick={onStart}>{done === 0 ? 'Start setup' : 'Continue setup'}</Button>
          </Box>
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(3, minmax(0, 1fr))' }} gap={{ base: 'spacing.5', m: 'spacing.6' }}>
            {SETUP_STEP_NAMES.map((name, i) => (
              <Box key={name} display="flex" flexDirection={{ base: 'row', m: 'column' }} alignItems={{ base: 'flex-start', m: 'stretch' }} gap="spacing.3">
                <Box display="flex" alignItems="center" gap="spacing.3">
                  {i < done ? <CheckCircleIcon size="xlarge" color="feedback.icon.positive.intense" /> : (
                    <Box width="spacing.7" height="spacing.7" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center" borderWidth={i === done ? 'thick' : 'thin'} borderColor={i === done ? 'surface.border.primary.normal' : 'surface.border.gray.normal'}>
                      <Text size="small" weight="semibold" color={i === done ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{i + 1}</Text>
                    </Box>
                  )}
                  {/* The line to the next step, across the top on a tablet or wider. On a phone the steps stack and there is no line. */}
                  {i < SETUP_STEPS - 1 && <Box display={{ base: 'none', m: 'block' }} flexGrow="1" height="spacing.0" borderTopWidth="thin" borderTopColor={i < done ? 'surface.border.gray.normal' : 'surface.border.gray.subtle'} />}
                </Box>
                <Box display="flex" flexDirection="column" gap="spacing.1">
                  <Text weight="semibold">{name}</Text>
                  <Text size="small" color="surface.text.gray.muted">{SETUP_STEP_HELP[i]}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}
