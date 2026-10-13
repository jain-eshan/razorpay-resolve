import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'
import { ZONE, cause, headline, when } from '../lib/format'
import { AgentAnswer, Analyzing, Divider, Label } from './AgentAnswer'

// Ray's answers on the home screen. Every figure comes straight from the incident and scan data; no model writes any text here.
type Inc = Schemas['IncidentSummary']

export function IncidentsAnswer() {
  const nav = useNavigate()
  const { data } = useGet<Inc[]>('/api/incidents')
  if (!data) return <Analyzing />
  if (data.length === 0) return <AgentAnswer title="Nothing is open" text="I checked Razorpay's records against yours and found no mismatches.">{null}</AgentAnswer>
  const sorted = [...data].sort((a, b) => b.affected - a.affected)
  const zones = (['after', 'before', 'during'] as const).filter((z) => sorted.some((i) => i.zone === z))
  const total = sorted.reduce((n, i) => n + i.at_risk_paise, 0)
  const top = sorted[0]
  return (
    <AgentAnswer
      title={`${sorted.length} payment issue${sorted.length === 1 ? '' : 's'}, ${rupees(total)} involved`}
      text="I compared Razorpay's records with your access records and grouped what I found by where the payment broke: before, during or after it. Biggest first."
      next={[
        { label: `Open the biggest: ${headline(top).toLowerCase()}`, onClick: () => nav(`/incidents/${top.id}`) },
        { label: 'See the first check', onClick: () => nav('/scan') },
        { label: 'See all payment issues', onClick: () => nav('/incidents') },
      ]}
    >
      {zones.map((z) => (
        <Box key={z} display="flex" flexDirection="column" gap="spacing.4">
          <Divider>{ZONE[z]}</Divider>
          {sorted.filter((i) => i.zone === z).map((i) => (
            <Card key={i.id}>
              <CardBody>
                <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', m: 'center' }} gap="spacing.5">
                  <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="0px">
                    <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap"><Heading as="h3" size="small">{headline(i)}</Heading><Badge size="medium" color={i.owner === 'merchant_code' || i.owner === 'merchant_config' ? 'notice' : 'neutral'}>{cause(i)}</Badge></Box>
                    <Text size="small" color="surface.text.gray.muted">{`${i.title} · since ${when(i.onset_at)} · ${i.complained} wrote in`}</Text>
                  </Box>
                  <Box display="flex" flexDirection="column" alignItems={{ base: 'flex-start', m: 'flex-end' }}><Heading as="h2" size="medium">{rupees(i.at_risk_paise)}</Heading><Label>Amount</Label></Box>
                  <Box display="flex" gap="spacing.3">
                    <Button size="small" variant={i.id === top.id ? 'primary' : 'secondary'} onClick={() => nav(`/incidents/${i.id}`)}>See who was hit</Button>
                    <Button size="small" variant="secondary" onClick={() => nav(`/incidents/${i.id}/dev`)}>Send to developer</Button>
                  </Box>
                </Box>
              </CardBody>
            </Card>
          ))}
        </Box>
      ))}
    </AgentAnswer>
  )
}

export function ScanAnswer() {
  const nav = useNavigate()
  const { data } = useGet<Schemas['ScanResult']>('/api/scan/day0')
  if (!data) return <Analyzing />
  return (
    <AgentAnswer
      title={`${data.leaked_customers} customers paid and did not get access`}
      text="I checked Razorpay's records against your access records. Nothing has been changed."
      next={[{ label: 'See what caused it', onClick: () => nav('/scan') }, { label: 'See all payment issues', onClick: () => nav('/incidents') }]}
    >
      <Card>
        <CardBody>
          <Box display="flex" gap="spacing.9" flexWrap="wrap">
            <Box display="flex" flexDirection="column"><Label>Customers without access</Label><Heading as="h2" size="large">{String(data.leaked_customers)}</Heading></Box>
            <Box display="flex" flexDirection="column"><Label>Paid by them</Label><Heading as="h2" size="large">{rupees(data.leaked_paise)}</Heading></Box>
            <Box display="flex" flexDirection="column"><Label>Payment issues found</Label><Heading as="h2" size="large">{String(data.incidents.length)}</Heading></Box>
          </Box>
        </CardBody>
      </Card>
    </AgentAnswer>
  )
}
