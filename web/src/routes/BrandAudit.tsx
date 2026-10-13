import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Badge, Box, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { MenuPick } from '../components/MenuPick'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { useGet } from '../lib/api'
import { useApproved } from '../lib/approvals'
import { when } from '../lib/format'

// The brand's audit trail as `synth/brand_world.py` writes it (web/public/brand/audit.json): what happened on the account, newest first, plus the approvals a judge can make
// on FK-1 in this tab (lib/approvals.ts), in the file's words.
type Kind = 'alert' | 'root_cause' | 'sign_off' | 'approval' | 'action' | 'setup'
type Entry = { id: string; at: string | null; kind: Kind; summary: string; actor: string; ref: string | null }
type Data = { kinds: Record<Kind, string>; events: Entry[]; pending: { issue: string; action: string; summary: string }[]; pending_actor: string }
const TONE = { alert: 'neutral', root_cause: 'information', sign_off: 'positive', approval: 'primary', action: 'neutral', setup: 'neutral' } as const

const Ref = ({ id }: { id: string }) => <RouterLink to={`/incidents/${id}`} style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">{id}</Text></RouterLink>
const time = (e: Entry) => (e.at ? when(e.at) : 'In this tab')

// Audit trail for the brand (`/audit`, PRD F17): a list page (web/DESIGN.md section 15) like Kaksha's, with a kind filter; one card per entry below `l`.
export default function BrandAudit() {
  const { data, error } = useGet<Data>('/api/brand/audit')
  // Only FK-1 waits for approvals in the data (a test in synth/tests/test_j2_brand.py checks it), so the trail follows that one issue's approvals.
  const issue = data?.pending[0]?.issue ?? ''
  const approved = useApproved(issue)
  const [kind, setKind] = useState<'all' | Kind>('all')
  if (!data && !error) return <PageSkeleton />
  // Approved in this tab: newest first, above everything from the data.
  const mine: Entry[] = [...approved].reverse().flatMap((a) => {
    const p = data?.pending.find((x) => x.action === a)
    return p ? [{ id: `tab-${a}`, at: null, kind: 'approval' as const, summary: p.summary, actor: data!.pending_actor, ref: p.issue }] : []
  })
  const all = [...mine, ...(data?.events ?? [])]
  const rows = all.filter((e) => kind === 'all' || e.kind === kind)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6" testID="brand-audit">
      <PageHeader title="Audit trail" description="Every alert, root cause, sign-off and approval on your account, with who did it and when. Nothing here can be edited." />
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="Could not load the audit trail" description={`${error}. Reload the page to try again.`} />}
      {data && (
        // Seven kinds are too many for a segmented control (at 375px "Root cause" wrapped and "Setup" fell off the edge), so the filter is the page-filter dropdown.
        <Panel title="Entries" subtitle="Newest first" pad={false} trailing={
          <Box display="flex" alignItems="center" gap="spacing.4">
            <Text size="small" color="surface.text.gray.muted">{`${rows.length} entries`}</Text>
            <MenuPick size="small" label="Kind" value={kind} onPick={setKind} options={[{ id: 'all' as const, label: 'All' }, ...(Object.entries(data.kinds) as [Kind, string][]).map(([id, label]) => ({ id, label }))]} />
          </Box>
        }>
          {rows.length === 0 ? (
            <Box padding="spacing.6"><Text color="surface.text.gray.muted">Nothing of this kind yet.</Text></Box>
          ) : (<>
            <Box display={{ base: 'none', l: 'block' }}>
              <Table data={{ nodes: rows }} gridTemplateColumns="minmax(130px, 1.1fr) minmax(110px, 0.9fr) minmax(320px, 4fr) minmax(170px, 1.5fr)" isHeaderSticky={false}>
                {(items) => (
                  <>
                    <TableHeader>
                      <TableHeaderRow>
                        <TableHeaderCell>Time</TableHeaderCell>
                        <TableHeaderCell>Kind</TableHeaderCell>
                        <TableHeaderCell>What happened</TableHeaderCell>
                        <TableHeaderCell>Who</TableHeaderCell>
                      </TableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((e) => (
                        <TableRow key={e.id} item={e}>
                          <TableCell><Text size="small">{time(e)}</Text></TableCell>
                          <TableCell><Badge color={TONE[e.kind]} size="medium">{data.kinds[e.kind]}</Badge></TableCell>
                          <TableCell><Box paddingY="spacing.3"><Text>{e.summary}</Text></Box></TableCell>
                          <TableCell><Box display="flex" flexDirection="column"><Text size="small">{e.actor}</Text>{e.ref && <Ref id={e.ref} />}</Box></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
            </Box>
            <Box display={{ base: 'block', l: 'none' }}>
              {rows.map((e) => (
                <Box key={e.id} padding="spacing.5" display="flex" flexDirection="column" gap="spacing.2" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle" testID="audit-card">
                  <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap"><Badge color={TONE[e.kind]} size="small">{data.kinds[e.kind]}</Badge><Text size="small" color="surface.text.gray.muted">{time(e)}</Text></Box>
                  <Text>{e.summary}</Text>
                  <Box display="flex" gap="spacing.3" flexWrap="wrap"><Text size="small" color="surface.text.gray.muted">{e.actor}</Text>{e.ref && <Ref id={e.ref} />}</Box>
                </Box>
              ))}
            </Box>
          </>)}
        </Panel>
      )}
    </Box>
  )
}
