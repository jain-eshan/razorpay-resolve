import { useNavigate } from 'react-router-dom'
import { Box, Button, Card, CardBody, Heading, RayIcon, Text } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'

// Simulated WhatsApp. RAY is Razorpay's product; this shows what its message could carry.
export default function Ray() {
  const nav = useNavigate()
  const { data: incs, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  const id = incs?.[0]?.id
  const { data: card } = useGet<Schemas['RayCard']>(id ? `/api/incidents/${id}/ray_card` : null)
  const { data: members } = useGet<Schemas['Member'][]>(id ? `/api/incidents/${id}/members` : null)
  const inc = incs?.[0]
  const atAlert = inc?.would_have_alerted_at && members ? members.filter((m) => m.captured_at <= inc.would_have_alerted_at!).length : null

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.5">
      <Box display="flex" flexDirection="column" gap="spacing.2" maxWidth="560px" textAlign="center">
        <Heading size="xlarge">RAY on WhatsApp</Heading>
        <Text color="surface.text.gray.muted">Simulated. Blindspot gives RAY something to say before the founder hears it from a customer.</Text>
      </Box>
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      {inc && card && (
        <Box width="100%" maxWidth="380px" backgroundColor="surface.background.gray.subtle" borderRadius="xlarge" borderWidth="thin" borderColor="surface.border.gray.normal" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.5">
          <Box display="flex" alignItems="center" gap="spacing.3">
            <RayIcon size="large" color="surface.icon.onSea.onSubtle" />
            <Text weight="semibold">RAY</Text>
            <Text size="small" color="surface.text.gray.muted">simulated</Text>
          </Box>

          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Text size="small" color="surface.text.gray.muted">{when(inc.would_have_alerted_at!)}</Text>
            <Card>
              <CardBody>
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  <Text size="small" weight="semibold" color="feedback.text.notice.intense">Heads up · {card.owner_chip}</Text>
                  <Text>Your webhook is failing. Your server is answering Razorpay with an error, so paid customers are not getting access.</Text>
                  <Text>{atAlert} customer affected so far. I'll keep watching.</Text>
                </Box>
              </CardBody>
            </Card>
          </Box>

          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Text size="small" color="surface.text.gray.muted">Friday, after a complaint</Text>
            <Card>
              <CardBody>
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  <Text size="small" weight="semibold" color="feedback.text.notice.intense">{card.owner_chip}</Text>
                  <Text>{card.cause_line}</Text>
                  <Text>
                    {card.affected} customers paid and have no access. {card.complained} complained, {card.silent} did not. {rupees(card.at_risk_paise)} at risk.
                  </Text>
                  <Box display="flex" gap="spacing.3">
                    <Button size="small" onClick={() => nav(`/incidents/${card.incident_id}`)}>{card.buttons[0]}</Button>
                    <Button size="small" variant="secondary" isDisabled>{card.buttons[1]}</Button>
                  </Box>
                </Box>
              </CardBody>
            </Card>
          </Box>
        </Box>
      )}
      {!inc && !error && <Text color="surface.text.gray.muted">Nothing to report. No mismatches found.</Text>}
    </Box>
  )
}
