import { Link, useParams } from 'react-router-dom'
import { Alert, Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'

const OWNER: Record<Schemas['IncidentDetail']['owner'], string> = {
  merchant_code: 'Your side · Code',
  merchant_config: 'Your side · Setup',
  razorpay: 'Razorpay side',
  bank: 'Bank side',
  customer: 'Customer side',
  unknown: 'Not sure yet',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <Text size="small" color="surface.text.gray.muted">{label}</Text>
        <Heading size="large">{value}</Heading>
      </CardBody>
    </Card>
  )
}

export default function Incident() {
  const { id = '' } = useParams()
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!inc) return <Text color="surface.text.gray.muted">Loading</Text>
  const v = inc.verdict
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Box display="flex" flexDirection="column" gap="spacing.3">
        <Link to="/" style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">All incidents</Text></Link>
        <Text size="small" color="surface.text.gray.muted">R0 placeholder data</Text>
      </Box>

      <Alert
        color="notice"
        isDismissible={false}
        title={`${inc.inferred ? 'Inferred. ' : ''}${OWNER[inc.owner]} · confidence ${v.confidence}`}
        description={inc.title}
      />

      <Box display="grid" gridTemplateColumns={{ base: '1fr 1fr', m: 'repeat(4, 1fr)' }} gap="spacing.5">
        <Stat label="Affected" value={String(inc.affected)} />
        <Stat label="Complained" value={String(inc.complained)} />
        <Stat label="Silent" value={String(inc.silent)} />
        <Stat label="At risk" value={rupees(inc.at_risk_paise)} />
      </Box>

      <Box display="flex" flexDirection="column" gap="spacing.3">
        <Heading size="medium">Evidence</Heading>
        {v.evidence.map((e) => (
          <Text key={e.ref}>{e.kind.replaceAll('_', ' ')} · weight {e.weight}</Text>
        ))}
      </Box>

      {v.what_we_cannot_see.length > 0 && (
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <Heading size="medium">What we cannot see</Heading>
          {v.what_we_cannot_see.map((s) => (
            <Text key={s} color="surface.text.gray.muted">{s}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
