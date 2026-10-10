import { Link as RouterLink } from 'react-router-dom'
import { AlertTriangleIcon, Badge, Box, RupeesIcon, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text, UsersIcon } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { rupees, useGet, type Schemas } from '../lib/api'
import { OWNER, ZONE, sentence, when } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'

const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'negative', bank: 'information', customer: 'neutral', unknown: 'neutral' } as const
const STATUS_TONE = { open: 'notice', fixing: 'information', verifying: 'information', closed: 'positive' } as const
// Why a zone can be empty, so a 0 reads as covered, not as missing data. From the Incidents guide: Blindspot covers before and after the payment.
const EMPTY: Record<string, string> = {
  before: 'Nothing found before Razorpay.',
  during: "Bank and UPI failures inside the payment are on Razorpay's own dashboard, so Blindspot does not look here.",
  after: 'Nothing found after the payment.',
}
// "Could have known" on the same day as the start needs only the time.
// The incident's title as a link that wraps. Blade's Link keeps its text on one line (max-content), which cuts long titles off, so this is the
// router link around Blade text, as the Explore cards on the home do.
function Title({ id, title }: { id: string; title: string }) {
  return <RouterLink to={`/incidents/${id}`} style={{ textDecoration: 'none' }}><Text weight="semibold" color="interactive.text.primary.normal">{title}</Text></RouterLink>
}
const knownAt = (start: string, known: string) => {
  const [d1] = when(start).split(', '), [d2, t2] = when(known).split(', ')
  return d1 === d2 ? `Could have known at ${t2}` : `Could have known ${when(known)}`
}

export default function Incidents() {
  const { data, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  if (!data && !error) return <PageSkeleton />
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="Incidents" description="Grouped by where the payment broke." guide="incidents" />
      {error && <Text color="feedback.text.negative.intense">Could not load incidents: {error}</Text>}
      {data?.length === 0 && <Text>No mismatches found. We check every 15 minutes.</Text>}
      {data && data.length > 0 && (() => {
        // Added up from the incidents below. Inferred incidents carry an estimate, so the hint says how much of the total is one.
        const open = data.filter((i) => i.status !== 'closed')
        const est = data.filter((i) => i.inferred).reduce((a, i) => a + i.affected, 0)
        const estPaise = data.filter((i) => i.inferred).reduce((a, i) => a + i.at_risk_paise, 0)
        return (
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
            <Stat label="Open" value={String(open.length)} hint={`of ${data.length} incidents`} icon={AlertTriangleIcon} tone="notice" />
            <Stat label="At risk" value={rupees(data.reduce((a, i) => a + i.at_risk_paise, 0))} hint={estPaise ? `about ${rupees(estPaise)} of it estimated` : `across ${data.length} incidents`} icon={RupeesIcon} />
            <Stat label="Customers affected" value={String(data.reduce((a, i) => a + i.affected, 0))} hint={est ? `about ${est} of them estimated` : 'every one matched to a payment'} icon={UsersIcon} />
          </Box>
        )
      })()}
      {(['before', 'during', 'after'] as const).map((zone) => {
        const items = (data ?? []).filter((i) => i.zone === zone)
        return (
          <Panel key={zone} title={ZONE[zone]} pad={false} trailing={<Badge color="neutral" size="medium">{`${items.length} found`}</Badge>}>
            {items.length === 0 ? <Box padding="spacing.5"><Text size="small" color="surface.text.gray.muted">{EMPTY[zone]}</Text></Box> : (<>
              <Box display={{ base: 'none', l: 'block' }}>
              <Table data={{ nodes: items }} gridTemplateColumns="minmax(240px, 2.6fr) minmax(170px, 1.5fr) minmax(80px, 0.7fr) minmax(100px, 0.9fr) minmax(90px, 0.8fr) minmax(190px, 1.6fr)" isHeaderSticky={false}>
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
                          <TableCell><Box display="flex" flexDirection="column" paddingY="spacing.3"><Title id={i.id} title={i.title} /><Text size="small" color="surface.text.gray.muted">{i.id}</Text></Box></TableCell>
                          <TableCell><Badge size="medium" color={OWNER_TONE[i.owner]}>{`${i.inferred ? 'Inferred. ' : ''}${OWNER[i.owner]}`}</Badge></TableCell>
                          <TableCell><Badge size="medium" color={STATUS_TONE[i.status]}>{sentence(i.status)}</Badge></TableCell>
                          <TableCell><Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{i.affected}</Text><Text size="small" color="surface.text.gray.muted">{i.complained} complained</Text></Box></TableCell>
                          <TableCell><Text>{rupees(i.at_risk_paise)}</Text></TableCell>
                          <TableCell><Box display="flex" flexDirection="column"><Text>{when(i.onset_at)}</Text>{i.would_have_alerted_at && <Text size="small" color="surface.text.gray.muted">{knownAt(i.onset_at, i.would_have_alerted_at)}</Text>}</Box></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
              </Box>
              {/* Below l (phones and tablets, where the column is under about 780px): one card per incident, so the figures are not pushed off the side of a table. */}
              <Box display={{ base: 'block', l: 'none' }}>
                {items.map((i) => (
                  <Box key={i.id} padding="spacing.5" display="flex" flexDirection="column" gap="spacing.2" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                    <Title id={i.id} title={i.title} />
                    <Box display="flex" gap="spacing.2" flexWrap="wrap">
                      <Badge size="small" color={OWNER_TONE[i.owner]}>{`${i.inferred ? 'Inferred. ' : ''}${OWNER[i.owner]}`}</Badge>
                      <Badge size="small" color={STATUS_TONE[i.status]}>{sentence(i.status)}</Badge>
                    </Box>
                    <Text weight="semibold" color="surface.text.gray.subtle">{`${i.affected} affected · ${rupees(i.at_risk_paise)} at risk`}</Text>
                    <Text size="small" color="surface.text.gray.muted">{`${i.id} · started ${when(i.onset_at)} · ${i.complained} complained`}</Text>
                  </Box>
                ))}
              </Box>
            </>)}
          </Panel>
        )
      })}
    </Box>
  )
}
