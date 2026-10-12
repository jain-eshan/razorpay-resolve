import { Link } from 'react-router-dom'
import { Badge, Box, Button, Card, CardBody, CheckCircleIcon, ChevronRightIcon, Heading, ProgressBar, Text } from '@razorpay/blade/components'
import { SETUP_STEP_HELP, SETUP_STEP_NAMES, SETUP_STEPS } from '../lib/setup'

// The three setup steps on the Overview, in the spirit of Razorpay's "Get started" strip and Shopify's setup guide: a title with its one blue button, a thin
// progress bar, and one tile per step. A done step has a green tick and says so, the next step has a blue ring and a blue edge, later steps are grey and wait.
// A tile opens that step in Setup (`/setup?step=`); a step you have not reached yet is not a link.
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
          <ProgressBar value={(done / SETUP_STEPS) * 100} size="small" color="positive" showPercentage={false} accessibilityLabel={`Setup progress: ${done} of ${SETUP_STEPS} steps`} />
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.4">
            {SETUP_STEP_NAMES.map((name, i) => {
              const tile = (
                <Box height="100%" display="flex" alignItems="flex-start" gap="spacing.4" padding="spacing.5" borderRadius="medium" borderWidth="thin"
                  borderColor={i === done ? 'surface.border.primary.muted' : 'surface.border.gray.subtle'} backgroundColor={i < done ? 'feedback.background.positive.subtle' : 'surface.background.gray.subtle'}>
                  {i < done ? <Box flexShrink={0} display="flex"><CheckCircleIcon size="xlarge" color="feedback.icon.positive.intense" /></Box> : (
                    <Box width="spacing.7" height="spacing.7" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center" backgroundColor="surface.background.gray.intense" borderWidth={i === done ? 'thick' : 'thin'} borderColor={i === done ? 'surface.border.primary.normal' : 'surface.border.gray.normal'}>
                      <Text size="small" weight="semibold" color={i === done ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{i + 1}</Text>
                    </Box>
                  )}
                  <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
                    <Text weight="semibold">{name}</Text>
                    <Text size="small" color="surface.text.gray.muted">{i < done ? 'Done' : SETUP_STEP_HELP[i]}</Text>
                  </Box>
                  {i <= done && <Box marginLeft="auto" flexShrink={0} display="flex" alignSelf="center"><ChevronRightIcon size="medium" color="surface.icon.gray.muted" /></Box>}
                </Box>
              )
              return i <= done ? <Link key={name} to={`/setup?step=${i}`} style={{ textDecoration: 'none' }}>{tile}</Link> : <Box key={name}>{tile}</Box>
            })}
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}
