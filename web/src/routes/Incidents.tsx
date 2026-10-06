import { Link } from 'react-router-dom'
import { Box, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'
import { OWNER, ZONE, when } from '../lib/format'

export default function Incidents() {
  const { data, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Heading size="xlarge">Incidents</Heading>
      <Text color="surface.text.gray.muted">Grouped by where the payment broke. Synthetic data: the merchant and customers are fictional.</Text>
      {error && <Text color="feedback.text.negative.intense">Could not load incidents: {error}</Text>}
      {data?.length === 0 && <Text>No mismatches found. We check every 15 minutes.</Text>}
      {(['before', 'during', 'after'] as const).map((zone) => {
        const items = data?.filter((i) => i.zone === zone) ?? []
        return (
          <Box key={zone} display="flex" flexDirection="column" gap="spacing.3">
            <Text weight="semibold">{ZONE[zone]}</Text>
            {items.length === 0 && <Text size="small" color="surface.text.gray.muted">Nothing found here.</Text>}
            {items.map((i) => (
              <Link key={i.id} to={`/incidents/${i.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card>
                  <CardBody>
                    <Box display="flex" flexDirection="column" gap="spacing.2">
                      <Text size="small" color="feedback.text.notice.intense">{i.inferred ? 'Inferred · ' : ''}{OWNER[i.owner]} · {i.status}</Text>
                      <Heading size="medium">{i.title}</Heading>
                      <Text>
                        {i.affected} affected · {i.complained} complained · {i.silent} silent · {rupees(i.at_risk_paise)} at risk
                      </Text>
                      <Text size="small" color="surface.text.gray.muted">Started {when(i.onset_at)}{i.would_have_alerted_at ? ` · would have alerted ${when(i.would_have_alerted_at)}` : ''}</Text>
                    </Box>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </Box>
        )
      })}
    </Box>
  )
}
