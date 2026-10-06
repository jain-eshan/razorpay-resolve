import { Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { useGet, type Schemas } from '../lib/api'

const COLOR = { pass: 'feedback.text.positive.intense', fail: 'feedback.text.negative.intense', report: 'surface.text.gray.muted', 'n/a': 'surface.text.gray.muted' } as const

// "How we know it works": every number here comes from comparing the pipeline with hidden ground truth in a synthetic world.
export default function How() {
  const { data, error } = useGet<Schemas['EvalReport']>('/api/eval/report')
  if (error) return <Text color="feedback.text.negative.intense">Could not load the report: {error}</Text>
  if (!data) return <Text color="surface.text.gray.muted">Loading</Text>
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Heading size="xlarge">How we know it works</Heading>
      <Text color="surface.text.gray.muted">
        Synthetic world, seed {data.seed}. The pipeline never sees the ground truth. This world is clean, so near-perfect scores are expected here. Harder cases arrive in later releases.
      </Text>
      {data.metrics.map((m) => (
        <Card key={m.name}>
          <CardBody>
            <Box display="grid" gridTemplateColumns={{ base: '1fr', m: '2fr 1fr 2fr 0.7fr' }} gap="spacing.3">
              <Text weight="semibold">{m.name.replaceAll('_', ' ')}</Text>
              <Text>{m.value ?? 'n/a'}</Text>
              <Text size="small" color="surface.text.gray.muted">Target {m.target}</Text>
              <Text size="small" weight="semibold" color={COLOR[m.status]}>{m.status}</Text>
            </Box>
          </CardBody>
        </Card>
      ))}
    </Box>
  )
}
