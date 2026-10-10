import { Badge, Box, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { useGet, type Schemas } from '../lib/api'
import { sentence } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'

const TONE = { pass: 'positive', fail: 'negative', report: 'neutral', 'n/a': 'neutral' } as const

// "How we know it works": every number here comes from comparing the pipeline with hidden ground truth in a synthetic world.
export default function How() {
  const { data, error } = useGet<Schemas['EvalReport']>('/api/eval/report')
  if (error) return <Text color="feedback.text.negative.intense">Could not load the report: {error}</Text>
  if (!data) return <PageSkeleton />
  const gates = data.metrics.filter((m) => m.status === 'pass' || m.status === 'fail')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader guide="how" title="How we know it works" description={`Synthetic world, seed ${data.seed}. The pipeline never sees the ground truth. This world is clean, so near-perfect scores are expected here. Harder cases arrive in later releases.`} />
      <Panel title="Checks against ground truth" pad={false} trailing={<Badge size="medium" color={gates.every((g) => g.status === 'pass') ? 'positive' : 'negative'}>{`${gates.filter((g) => g.status === 'pass').length} of ${gates.length} gates pass`}</Badge>}>
        <Table data={{ nodes: data.metrics.map((m) => ({ ...m, id: m.name })) }} gridTemplateColumns="minmax(300px, 3fr) minmax(100px, 1fr) minmax(300px, 3fr) minmax(90px, 0.9fr)" isHeaderSticky={false}>
          {(rows) => (
            <>
              <TableHeader>
                <TableHeaderRow><TableHeaderCell>Check</TableHeaderCell><TableHeaderCell>Value</TableHeaderCell><TableHeaderCell>Target</TableHeaderCell><TableHeaderCell>Result</TableHeaderCell></TableHeaderRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.name} item={m}>
                    <TableCell><Text weight="semibold" color="surface.text.gray.subtle">{sentence(m.name).replace('Day0', 'Day-0')}</Text></TableCell>
                    <TableCell><Text>{m.value ?? 'n/a'}</Text></TableCell>
                    <TableCell><Text size="small" color="surface.text.gray.muted">{m.target}</Text></TableCell>
                    <TableCell><Badge size="medium" color={TONE[m.status]}>{m.status}</Badge></TableCell>
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
