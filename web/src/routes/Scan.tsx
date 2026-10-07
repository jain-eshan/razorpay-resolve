import { useNavigate } from 'react-router-dom'
import { AlertTriangleIcon, Alert, Badge, Box, CheckCircleIcon, Link, RupeeIcon, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { rupees, useGet, type Schemas } from '../lib/api'
import { PageHeader } from '../components/PageHeader'

// Day 0: the first thing a merchant sees on connecting. It finds money that is already stuck.
export default function Scan() {
  const nav = useNavigate()
  const { data, error } = useGet<Schemas['ScanResult']>('/api/scan/day0')
  if (error) return <Text color="feedback.text.negative.intense">Could not load the scan: {error}</Text>
  if (!data) return <Text color="surface.text.gray.muted">Scanning</Text>
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="Day-0 scan" description="Here is what I found." guide="scan" />
      <Alert isFullWidth color={data.leaked_customers ? 'notice' : 'positive'} isDismissible={false} title={data.headline} description="Checked against Razorpay's records and your access records. Nothing has been changed." />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', m: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
        <Stat label="Customers without access" value={String(data.leaked_customers)} icon={AlertTriangleIcon} tone="notice" />
        <Stat label="Paid and not restored" value={rupees(data.leaked_paise)} icon={RupeeIcon} />
        <Stat label="Incidents" value={String(data.incidents.length)} icon={CheckCircleIcon} />
      </Box>
      <Panel title="Incidents behind it" pad={false}>
        <Table data={{ nodes: data.incidents }} gridTemplateColumns="minmax(300px, 3fr) minmax(100px, 1fr) minmax(100px, 1fr)" isHeaderSticky={false}>
          {(rows) => (
            <>
              <TableHeader>
                <TableHeaderRow><TableHeaderCell>Incident</TableHeaderCell><TableHeaderCell>Affected</TableHeaderCell><TableHeaderCell>At risk</TableHeaderCell></TableHeaderRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id} item={i}>
                    <TableCell><Box display="flex" flexDirection="column"><Link href={`/incidents/${i.id}`} onClick={(e) => { e.preventDefault(); nav(`/incidents/${i.id}`) }}>{i.title}</Link><Badge size="medium" color="notice">{i.id}</Badge></Box></TableCell>
                    <TableCell><Text>{i.affected}</Text></TableCell>
                    <TableCell><Text>{rupees(i.at_risk_paise)}</Text></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}
        </Table>
      </Panel>
    </Box>
  )
}
