import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, ArrowRightIcon, Badge, BellIcon, Box, Button, Card, CardBody, CheckCircleIcon, EmptyState, FilterIcon, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text, ZapIcon } from '@razorpay/blade/components'
import { GuideArt } from '../components/GuideArt'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'

// One alert as `synth/brand_world.py` writes it (web/public/brand/alerts.json): what the brand's tool sent, and what Resolve did with it, in the file's words.
export type BrandAlert = { id: string; tool: string; title: string; service: string; at: string; events: number; status: 'matched' | 'dropped' | 'no_impact'; issue: string | null; why: string }
// What Resolve did. Orange when customers were hit (it became a payment issue), grey when the filter left it out, green when it was checked and payments were fine.
const DID = { matched: ['Matched to payments', 'notice'], dropped: ['Left out by your filter', 'neutral'], no_impact: ['Checked, no impact', 'positive'] } as const

// The issue an alert became, as a link that wraps (Blade's Link does not), as on the Payment issues page.
function IssueLink({ id, headline }: { id: string; headline?: string }) {
  return <RouterLink to={`/incidents/${id}`} style={{ textDecoration: 'none' }}><Text size="small" weight="semibold" color="interactive.text.primary.normal">{headline ?? id}</Text></RouterLink>
}
const source = (a: BrandAlert) => `${a.tool} · ${a.service} · ${a.events === 1 ? '1 event' : `${a.events.toLocaleString('en-IN')} events`}`

// Alerts (`/alerts`, the brand account only; PRD F4, "match before acting"): what the brand's alert tools and Razorpay's own monitor sent, and what became of each one.
// A list page (web/DESIGN.md section 15): stat cards added up from the rows, then the list, newest first; one card per alert below `l`.
export default function BrandAlerts() {
  const nav = useNavigate()
  const { data, error } = useGet<BrandAlert[]>('/api/alerts')
  // The brand's issue list carries the customer-first headline beside the engine's fields (synth/brand_world.py `summary`).
  const { data: issues, error: issuesError } = useGet<(Schemas['IncidentSummary'] & { headline: string })[]>('/api/incidents')
  // Both load before the page shows, so the issue headlines do not arrive after the rows and move them.
  if ((!data || !issues) && !error && !issuesError) return <PageSkeleton />
  const headline = (id: string) => issues?.find((i) => i.id === id)?.headline
  const count = (s: BrandAlert['status']) => (data ?? []).filter((a) => a.status === s).length
  const matchedIssues = new Set((data ?? []).filter((a) => a.issue).map((a) => a.issue)).size
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6" testID="brand-alerts">
      <PageHeader title="Alerts" description="What your alert tools and Razorpay's own monitor sent, and what Resolve did with each. An alert alone is never acted on: it is checked against your payments first." />
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="Could not load alerts" description={`${error}. Reload the page to try again.`} />}
      {data?.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState size="large" asset={<Box width="120px"><GuideArt art="alert" height="80px" /></Box>} title="No alerts yet"
              description="When Sentry, Datadog or PagerDuty send an alert about a payment service, it shows here with what Resolve did with it.">
              <Button variant="primary" size="medium" icon={ArrowRightIcon} iconPosition="right" onClick={() => nav('/connect')}>See the alert door</Button>
            </EmptyState>
          </CardBody>
        </Card>
      )}
      {data && data.length > 0 && (<>
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }} gap="spacing.5" testID="alert-stats">
          <Stat label="Alerts received" value={String(data.length)} hint={`from ${new Set(data.map((a) => a.tool)).size} sources`} icon={BellIcon} />
          <Stat label="Matched to payments" value={String(count('matched'))} hint={`in ${matchedIssues} payment issues`} icon={ZapIcon} tone="notice" />
          <Stat label="Left out by your filter" value={String(count('dropped'))} hint="not payment services" icon={FilterIcon} />
          <Stat label="Checked, no impact" value={String(count('no_impact'))} hint="payments were normal" icon={CheckCircleIcon} tone="positive" />
        </Box>
        <Panel title="Alerts" subtitle="Newest first" pad={false} trailing={<Badge color="neutral" size="medium">{`${data.length} alerts`}</Badge>} testID="alert-list">
          <Box display={{ base: 'none', l: 'block' }}>
            <Table data={{ nodes: data }} gridTemplateColumns="minmax(220px, 1.6fr) minmax(130px, 0.9fr) minmax(280px, 2.4fr) minmax(180px, 1.3fr)" isHeaderSticky={false}>
              {(rows) => (
                <>
                  <TableHeader>
                    <TableHeaderRow>
                      <TableHeaderCell>Alert</TableHeaderCell>
                      <TableHeaderCell>Received</TableHeaderCell>
                      <TableHeaderCell>What Resolve did</TableHeaderCell>
                      <TableHeaderCell>Payment issue</TableHeaderCell>
                    </TableHeaderRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => (
                      <TableRow key={a.id} item={a}>
                        <TableCell><Box display="flex" flexDirection="column" paddingY="spacing.3"><Text weight="semibold">{a.title}</Text><Text size="small" color="surface.text.gray.muted">{source(a)}</Text></Box></TableCell>
                        <TableCell><Text size="small">{when(a.at)}</Text></TableCell>
                        <TableCell><Box display="flex" flexDirection="column" gap="spacing.2" paddingY="spacing.3" alignItems="flex-start"><Badge size="medium" color={DID[a.status][1]}>{DID[a.status][0]}</Badge><Text size="small" color="surface.text.gray.muted">{a.why}</Text></Box></TableCell>
                        <TableCell>{a.issue ? <IssueLink id={a.issue} headline={headline(a.issue)} /> : <Text size="small" color="surface.text.gray.muted">None opened</Text>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </Box>
          {/* Below l the column is too narrow for four columns: one card per alert, the same fields in the same order. */}
          <Box display={{ base: 'block', l: 'none' }}>
            {data.map((a) => (
              <Box key={a.id} padding="spacing.5" display="flex" flexDirection="column" gap="spacing.2" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle" testID="alert-card">
                <Text weight="semibold">{a.title}</Text>
                <Text size="small" color="surface.text.gray.muted">{`${source(a)} · ${when(a.at)}`}</Text>
                <Box display="flex"><Badge size="small" color={DID[a.status][1]}>{DID[a.status][0]}</Badge></Box>
                <Text size="small" color="surface.text.gray.muted">{a.why}</Text>
                {a.issue && <IssueLink id={a.issue} headline={headline(a.issue)} />}
              </Box>
            ))}
          </Box>
        </Panel>
      </>)}
    </Box>
  )
}
