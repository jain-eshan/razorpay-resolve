import { useNavigate } from 'react-router-dom'
import { Badge, Box, Link, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { rupees, useGet, type Schemas } from '../lib/api'
import { OWNER, ZONE, sentence, when } from '../lib/format'
import { PageHeader } from '../components/PageHeader'

const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'negative', bank: 'information', customer: 'neutral', unknown: 'neutral' } as const
const STATUS_TONE = { open: 'notice', fixing: 'information', verifying: 'information', closed: 'positive' } as const

export default function Incidents() {
  const nav = useNavigate()
  const { data, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="Incidents" description="Grouped by where the payment broke." guide="incidents" />
      {error && <Text color="feedback.text.negative.intense">Could not load incidents: {error}</Text>}
      {data?.length === 0 && <Text>No mismatches found. We check every 15 minutes.</Text>}
      {(['before', 'during', 'after'] as const).map((zone) => {
        const items = (data ?? []).filter((i) => i.zone === zone)
        return (
          <Panel key={zone} title={ZONE[zone]} pad={false} trailing={<Badge color="neutral" size="medium">{`${items.length} found`}</Badge>}>
            {items.length === 0 ? undefined : (
              <Table data={{ nodes: items }} gridTemplateColumns="minmax(220px, 2.2fr) minmax(170px, 1.7fr) minmax(90px, 0.9fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(150px, 1.5fr)" isHeaderSticky={false}>
                {(rows) => (
                  <>
                    <TableHeader>
                      <TableHeaderRow>
                        <TableHeaderCell>Incident</TableHeaderCell>
                        <TableHeaderCell>Whose side</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Affected</TableHeaderCell>
                        <TableHeaderCell>At risk</TableHeaderCell>
                        <TableHeaderCell>Started</TableHeaderCell>
                      </TableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((i) => (
                        <TableRow key={i.id} item={i}>
                          <TableCell><Box display="flex" flexDirection="column"><Link href={`/incidents/${i.id}`} onClick={(e) => { e.preventDefault(); nav(`/incidents/${i.id}`) }}>{i.title}</Link><Text size="small" color="surface.text.gray.muted">{i.id}</Text></Box></TableCell>
                          <TableCell><Badge size="medium" color={OWNER_TONE[i.owner]}>{`${i.inferred ? 'Inferred. ' : ''}${OWNER[i.owner]}`}</Badge></TableCell>
                          <TableCell><Badge size="medium" color={STATUS_TONE[i.status]}>{sentence(i.status)}</Badge></TableCell>
                          <TableCell><Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{i.affected}</Text><Text size="small" color="surface.text.gray.muted">{i.complained} complained</Text></Box></TableCell>
                          <TableCell><Text>{rupees(i.at_risk_paise)}</Text></TableCell>
                          <TableCell><Box display="flex" flexDirection="column"><Text>{when(i.onset_at)}</Text>{i.would_have_alerted_at && <Text size="small" color="surface.text.gray.muted">Could have known {when(i.would_have_alerted_at)}</Text>}</Box></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
            )}
          </Panel>
        )
      })}
    </Box>
  )
}
