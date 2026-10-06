import { Badge, Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'

const COLOR = { approval: 'primary', action: 'neutral', verify: 'positive', policy: 'notice', llm_call: 'information', tool_call: 'information' } as const

// S-09. Every approval, action, verification and blocked send, newest first.
export default function Audit() {
  const { data, error } = useGet<Schemas['AuditEntry'][]>('/api/audit')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="xlarge">Audit log</Heading>
        <Text color="surface.text.gray.muted">Every approval, change and check, with who did it. Nothing here can be edited.</Text>
      </Box>
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      {data?.length === 0 && <Text color="surface.text.gray.muted">Nothing yet. Entries appear when you plan, approve or verify a fix.</Text>}
      {data?.map((e) => (
        <Card key={e.id}>
          <CardBody>
            <Box display="flex" gap="spacing.4" alignItems="flex-start" flexWrap="wrap">
              <Text size="small" color="surface.text.gray.muted">{when(e.at)}</Text>
              <Badge color={COLOR[e.kind]}>{e.kind.replace('_', ' ')}</Badge>
              <Box flex="1" minWidth="240px">
                <Text>{e.summary}</Text>
                <Text size="small" color="surface.text.gray.muted">{e.actor}{e.ref_id ? ` · ${e.ref_id}` : ''}</Text>
              </Box>
            </Box>
          </CardBody>
        </Card>
      ))}
    </Box>
  )
}
