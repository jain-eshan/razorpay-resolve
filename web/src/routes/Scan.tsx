import { Link } from 'react-router-dom'
import { Alert, Box, Heading, Text } from '@razorpay/blade/components'
import { Stat } from '../components/Stat'
import { rupees, useGet, type Schemas } from '../lib/api'

// Day 0: the first thing a merchant sees on connecting. It finds money that is already stuck.
export default function Scan() {
  const { data, error } = useGet<Schemas['ScanResult']>('/api/scan/day0')
  if (error) return <Text color="feedback.text.negative.intense">Could not load the scan: {error}</Text>
  if (!data) return <Text color="surface.text.gray.muted">Scanning</Text>
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Heading size="xlarge">Here is what I found</Heading>
      <Alert color={data.leaked_customers ? 'notice' : 'positive'} isDismissible={false} title={data.headline} description="Checked against Razorpay's records and your access records. Nothing has been changed." />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', m: 'repeat(3, 1fr)' }} gap="spacing.5">
        <Stat label="Customers without access" value={String(data.leaked_customers)} />
        <Stat label="Paid and not restored" value={rupees(data.leaked_paise)} />
        <Stat label="Incidents" value={String(data.incidents.length)} />
      </Box>
      {data.incidents.map((i) => (
        <Link key={i.id} to={`/incidents/${i.id}`} style={{ textDecoration: 'none' }}><Text color="interactive.text.primary.normal">{i.title}</Text></Link>
      ))}
    </Box>
  )
}
