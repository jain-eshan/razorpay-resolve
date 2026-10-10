import { useState } from 'react'
import { AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, Heading, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { useGet, type Schemas } from '../lib/api'
import { sentence } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { Stat } from '../components/Stat'
import { PageSkeleton } from '../components/PageSkeleton'

const TONE = { pass: 'positive', fail: 'negative', report: 'neutral', 'n/a': 'neutral' } as const
const pct = (x: number) => `${Math.round(x * 100)}%`
const num = (t: string) => Number(t.replace(/[^0-9.]/g, ''))
// The checks a founder would ask about first, in their words. Each value and target is read from the report; only the wording is ours.
const HEADLINE: [string, string, (v: number, t: string) => [string, string]][] = [
  ['day0_customers_found_vs_truth', 'Stuck customers the Day\u20110 scan found', (v, t) => [String(v), `out of ${num(t)} in the hidden truth`]],
  ['silent_victim_precision_exact_tier', 'Customers named who were really affected', (v, t) => [pct(v), `target ${pct(num(t))} or more`]],
  ['grants_that_ground_truth_says_were_not_owed', 'Access given to someone not owed it', (v) => [String(v), 'target none']],
  ['never_ask_violations_in_agent_replies', 'Replies that asked for a password, card or OTP', (v) => [String(v), 'target none']],
]

// "How we know it works": every number here comes from comparing the pipeline with hidden ground truth in a synthetic world.
export default function How() {
  const { data, error } = useGet<Schemas['EvalReport']>('/api/eval/report')
  const [all, setAll] = useState(false)
  if (error) return <Text color="feedback.text.negative.intense">Could not load the report: {error}</Text>
  if (!data) return <PageSkeleton />
  const gates = data.metrics.filter((m) => m.status === 'pass' || m.status === 'fail')
  const passed = gates.filter((g) => g.status === 'pass').length
  const reported = data.metrics.length - gates.length
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader guide="how" title="How we know it works" description={`Synthetic world, seed ${data.seed}. The pipeline never sees the ground truth. This world is clean, so near-perfect scores are expected here. Harder cases arrive in later releases.`} />
      {/* The answer first: the score, then four checks in plain words, then every check for anyone who wants them. */}
      <Card>
        <CardBody>
          <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} gap="spacing.5" alignItems={{ base: 'flex-start', m: 'center' }}>
            <Box width="56px" height="56px" flexShrink={0} borderRadius="medium" backgroundColor={passed === gates.length ? 'feedback.background.positive.subtle' : 'feedback.background.negative.subtle'} display="flex" alignItems="center" justifyContent="center">
              {passed === gates.length ? <CheckCircleIcon size="xlarge" color="feedback.icon.positive.intense" /> : <AlertTriangleIcon size="xlarge" color="feedback.icon.negative.intense" />}
            </Box>
            <Box display="flex" flexDirection="column" gap="spacing.1">
              <Heading size="xlarge">{`${passed} of ${gates.length} scored checks pass`}</Heading>
              <Text color="surface.text.gray.muted">{`Each one compares Blindspot's answer with the hidden truth of this synthetic world. ${reported} more are reported, not scored.`}</Text>
            </Box>
          </Box>
        </CardBody>
      </Card>
      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }} gap="spacing.5">
        {HEADLINE.map(([name, label, show]) => {
          const m = data.metrics.find((x) => x.name === name)
          if (!m || m.value === null || m.value === undefined) return null
          const [value, hint] = show(m.value, m.target)
          return <Stat key={name} label={label} value={value} hint={hint} icon={m.status === 'pass' ? CheckCircleIcon : AlertTriangleIcon} tone={m.status === 'pass' ? 'positive' : 'negative'} />
        })}
      </Box>
      <Panel title="Every check" pad={false} trailing={<Text size="small" color="surface.text.gray.muted">{`${data.metrics.length} checks`}</Text>}>
        {!all ? (
          <Box padding="spacing.5"><Button variant="secondary" size="medium" onClick={() => setAll(true)}>{`Show all ${data.metrics.length} checks`}</Button></Box>
        ) : (
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
        )}
      </Panel>
    </Box>
  )
}
