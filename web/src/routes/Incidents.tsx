import { Link } from 'react-router-dom'
import { Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'

export default function Incidents() {
  const { data, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Heading size="xlarge">Incidents</Heading>
      <Text color="surface.text.gray.muted">R0 placeholder data. Replaced by pipeline output from R1.</Text>
      {error && <Text color="feedback.text.negative.intense">Could not load incidents: {error}</Text>}
      {data?.map((i) => (
        <Link key={i.id} to={`/incidents/${i.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card>
            <CardBody>
              <Box display="flex" flexDirection="column" gap="spacing.2">
                <Text size="small" color="surface.text.gray.muted">
                  {i.id} · {i.zone === 'before' ? 'Before Razorpay' : i.zone === 'after' ? 'After the payment' : 'Inside the payment'}
                  {i.inferred ? ' · Inferred' : ''}
                </Text>
                <Heading size="medium">{i.title}</Heading>
                <Text>
                  {i.affected} affected · {i.complained} complained · {i.silent} silent · {rupees(i.at_risk_paise)} at risk
                </Text>
              </Box>
            </CardBody>
          </Card>
        </Link>
      ))}
    </Box>
  )
}
