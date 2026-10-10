import { useState } from 'react'
import { Badge, Box, SegmentedControl, SegmentedControlItem, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { useGet, type Schemas } from '../lib/api'
import { sentence, when } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'

const KINDS = ['all', 'approval', 'action', 'verify', 'policy', 'tool_call'] as const
const COLOR = { approval: 'primary', action: 'neutral', verify: 'positive', policy: 'notice', llm_call: 'information', tool_call: 'information' } as const

// S-09. Every approval, action, check and blocked message, newest first.
export default function Audit() {
  const { data, error } = useGet<Schemas['AuditEntry'][]>('/api/audit')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all')
  const rows = (data ?? []).filter((e) => kind === 'all' || e.kind === kind)
  if (!data && !error) return <PageSkeleton />
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="Audit log" description="Every approval, change and check, with who did it. Nothing here can be edited." />
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      <Panel title="Log" pad={false} trailing={<Text size="small" color="surface.text.gray.muted">{rows.length} entries</Text>}>
        <Box padding="spacing.5">
          <SegmentedControl label="Kind" name="kind" value={kind} onChange={({ value }) => setKind(value as (typeof KINDS)[number])}>
            {KINDS.map((k) => <SegmentedControlItem key={k} value={k}>{sentence(k)}</SegmentedControlItem>)}
          </SegmentedControl>
        </Box>
        {data && rows.length === 0 ? (
          <Box padding="spacing.6"><Text color="surface.text.gray.muted">Nothing yet. Entries appear when you plan, approve or verify a fix.</Text></Box>
        ) : (
          <Table data={{ nodes: rows }} gridTemplateColumns="minmax(120px, 1.2fr) minmax(100px, 1fr) minmax(400px, 4fr) minmax(180px, 1.8fr)" isHeaderSticky={false}>
            {(items) => (
              <>
                <TableHeader>
                  <TableHeaderRow>
                    <TableHeaderCell>Time</TableHeaderCell>
                    <TableHeaderCell>Kind</TableHeaderCell>
                    <TableHeaderCell>What happened</TableHeaderCell>
                    <TableHeaderCell>Who and what</TableHeaderCell>
                  </TableHeaderRow>
                </TableHeader>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.id} item={e}>
                      <TableCell><Text size="small">{when(e.at)}</Text></TableCell>
                      <TableCell><Badge color={COLOR[e.kind]} size="medium">{sentence(e.kind)}</Badge></TableCell>
                      <TableCell><Text>{e.summary}</Text></TableCell>
                      <TableCell><Box display="flex" flexDirection="column"><Text size="small">{e.actor}</Text>{e.ref_id && <Text size="small" color="surface.text.gray.muted">{e.ref_id}</Text>}</Box></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </>
            )}
          </Table>
        )}
      </Panel>
    </Box>
  )
}
