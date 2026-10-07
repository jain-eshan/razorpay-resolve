import { useNavigate } from 'react-router-dom'
import { Box, Button, Card, CardBody, Heading, RayIcon, Text } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'

// Simulated WhatsApp. RAY is Razorpay's product; this shows what its message could carry.
export default function Ray() {
  const nav = useNavigate()
  const { data: incs, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  const inc = incs?.find((i) => i.id === 'INC-1') ?? incs?.find((i) => i.zone === 'after' && i.mismatch_type !== 'G')    // Hero A: paid, and no access
  const incB = incs?.find((i) => i.zone === 'before' && i.id === 'INC-4') ?? incs?.find((i) => i.zone === 'before')   // Hero B: could not pay at all
  const incC = incs?.find((i) => i.mismatch_type === 'G')    // Razorpay's side: card renewals failed in its gateway
  const id = inc?.id
  const { data: card } = useGet<Schemas['RayCard']>(id ? `/api/incidents/${id}/ray_card` : null)
  const { data: cardB } = useGet<Schemas['RayCard']>(incB ? `/api/incidents/${incB.id}/ray_card` : null)
  const { data: cardC } = useGet<Schemas['RayCard']>(incC ? `/api/incidents/${incC.id}/ray_card` : null)
  const { data: members } = useGet<Schemas['Member'][]>(id ? `/api/incidents/${id}/members` : null)
  const atAlert = inc?.would_have_alerted_at && members ? members.filter((m) => m.captured_at <= inc.would_have_alerted_at!).length : null

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="large">RAY on WhatsApp</Heading>
        <Text color="surface.text.gray.muted">Simulated. Blindspot gives RAY something to say before the founder hears it from a customer.</Text>
      </Box>
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      {inc && card && (
        <Box width="100%" backgroundColor="surface.background.gray.subtle" borderRadius="xlarge" borderWidth="thin" borderColor="surface.border.gray.normal" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.5">
          <Box display="flex" alignItems="center" gap="spacing.3">
            <RayIcon size="large" color="surface.icon.onSea.onSubtle" />
            <Text weight="semibold">RAY</Text>
            <Text size="small" color="surface.text.gray.muted">simulated</Text>
          </Box>

          <Box display="grid" gridTemplateColumns={{ base: '1fr', m: 'repeat(2, minmax(0, 1fr))' }} gap="spacing.5" alignItems="start">
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
                      <Button size="small" variant="secondary" onClick={() => nav(`/incidents/${card.incident_id}/dev`)}>{card.buttons[1]}</Button>
                    </Box>
                  </Box>
                </CardBody>
              </Card>
            </Box>

            {incB && cardB && (
              <>
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  <Text size="small" color="surface.text.gray.muted">{when(incB.would_have_alerted_at ?? incB.onset_at)}, minutes after a deploy</Text>
                  <Card>
                    <CardBody>
                      <Box display="flex" flexDirection="column" gap="spacing.3">
                        <Text size="small" weight="semibold" color="feedback.text.notice.intense">Heads up · {cardB.owner_chip}</Text>
                        <Text>Your pay page is not answering. A change went live a few minutes before. Razorpay cannot see this, so I am telling you.</Text>
                        <Text>I'll keep watching.</Text>
                      </Box>
                    </CardBody>
                  </Card>
                </Box>
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  <Text size="small" color="surface.text.gray.muted">The next morning</Text>
                  <Card>
                    <CardBody>
                      <Box display="flex" flexDirection="column" gap="spacing.3">
                        <Text size="small" weight="semibold" color="feedback.text.notice.intense">{cardB.owner_chip}</Text>
                        <Text>{cardB.cause_line}</Text>
                        <Text>{cardB.affected} orders lost, about. {cardB.at_risk_paise ? `${rupees(cardB.at_risk_paise)} from customers who can still be reached.` : ''}</Text>
                        <Box display="flex" gap="spacing.3">
                          <Button size="small" onClick={() => nav(`/incidents/${cardB.incident_id}`)}>{cardB.buttons[0]}</Button>
                          <Button size="small" variant="secondary" onClick={() => nav(`/incidents/${cardB.incident_id}/dev`)}>{cardB.buttons[1]}</Button>
                        </Box>
                      </Box>
                    </CardBody>
                  </Card>
                </Box>
              </>
            )}

            {incC && cardC && (
              <>
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  <Text size="small" color="surface.text.gray.muted">{when(incC.would_have_alerted_at ?? incC.onset_at)}, before anyone wrote</Text>
                  <Card>
                    <CardBody>
                      <Box display="flex" flexDirection="column" gap="spacing.3">
                        <Text size="small" weight="semibold" color="feedback.text.notice.intense">Heads up · {cardC.owner_chip}</Text>
                        <Text>Card renewals are failing with the same gateway error, while UPI AutoPay renewals go through. Nothing changed on your side, so this looks like Razorpay's.</Text>
                        <Text>I'll keep watching.</Text>
                      </Box>
                    </CardBody>
                  </Card>
                </Box>
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  <Text size="small" color="surface.text.gray.muted">The picture so far</Text>
                  <Card>
                    <CardBody>
                      <Box display="flex" flexDirection="column" gap="spacing.3">
                        <Text size="small" weight="semibold" color="feedback.text.notice.intense">{cardC.owner_chip}</Text>
                        <Text>{cardC.cause_line}</Text>
                        <Text>{cardC.affected} renewals failed. {cardC.complained} customers wrote in, {cardC.silent} did not. {rupees(cardC.at_risk_paise)} still to collect.</Text>
                        <Box display="flex" gap="spacing.3">
                          <Button size="small" onClick={() => nav(`/incidents/${cardC.incident_id}`)}>{cardC.buttons[0]}</Button>
                          <Button size="small" variant="secondary" onClick={() => nav(`/incidents/${cardC.incident_id}`)}>{cardC.buttons[1]}</Button>
                        </Box>
                      </Box>
                    </CardBody>
                  </Card>
                </Box>
              </>
            )}
          </Box>
        </Box>
      )}
      {!inc && !error && <Text color="surface.text.gray.muted">Nothing to report. No mismatches found.</Text>}
    </Box>
  )
}
