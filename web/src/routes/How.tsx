import { Badge, Box, Heading, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { useGet, type Schemas } from '../lib/api'

const TONE = { pass: 'positive', fail: 'negative', report: 'neutral', 'n/a': 'neutral' } as const

// "How we know it works": every number here comes from comparing the pipeline with hidden ground truth in a synthetic world.
export default function How() {
  const { data, error } = useGet<Schemas['EvalReport']>('/api/eval/report')
  if (error) return <Text color="feedback.text.negative.intense">Could not load the report: {error}</Text>
  if (!data) return <Text color="surface.text.gray.muted">Loading</Text>
  const gates = data.metrics.filter((m) => m.status === 'pass' || m.status === 'fail')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="xlarge">How we know it works</Heading>
        <Text color="surface.text.gray.muted">
          Synthetic world, seed {data.seed}. The pipeline never sees the ground truth. This world is clean, so near-perfect scores are expected here. Harder cases arrive in later releases.
        </Text>
      </Box>
      <Panel title="Checks against ground truth" pad={false} trailing={<Badge size="medium" color={gates.every((g) => g.status === 'pass') ? 'positive' : 'negative'}>{`${gates.filter((g) => g.status === 'pass').length} of ${gates.length} gates pass`}</Badge>}>
        <Table data={{ nodes: data.metrics.map((m) => ({ ...m, id: m.name })) }} gridTemplateColumns="3fr 1fr 3fr 0.9fr" isHeaderSticky={false}>
          {(rows) => (
            <>
              <TableHeader>
                <TableHeaderRow><TableHeaderCell>Check</TableHeaderCell><TableHeaderCell>Value</TableHeaderCell><TableHeaderCell>Target</TableHeaderCell><TableHeaderCell>Result</TableHeaderCell></TableHeaderRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.name} item={m}>
                    <TableCell><Text weight="semibold" color="surface.text.gray.subtle">{m.name.replaceAll('_', ' ')}</Text></TableCell>
                    <TableCell><Text>{m.value ?? 'n/a'}</Text></TableCell>
                    <TableCell><Text size="small" color="surface.text.gray.muted">{m.target}</Text></TableCell>
                    <TableCell><Badge size="small" color={TONE[m.status]}>{m.status}</Badge></TableCell>
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
