import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, ClockIcon, Heading, Link, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { useGet, type Schemas } from '../lib/api'
import { sentence } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { rulesData } from '../lib/rulesData'
import { Stat } from '../components/Stat'
import { PageSkeleton } from '../components/PageSkeleton'

const TONE = { pass: 'positive', fail: 'negative', report: 'neutral', 'n/a': 'neutral' } as const
const pct = (x: number) => `${Math.round(x * 100)}%`
const num = (t: string) => Number(t.match(/[\d.]+/)?.[0] ?? 0)  // the first number in a target, which is the limit itself
// The checks a founder would ask about first, in their words. Each value and target is read from the report; only the wording is ours.
const HEADLINE: [string, string, (v: number, t: string) => [string, string]][] = [
  ['day0_customers_found_vs_truth', 'Stuck customers the first check found', (v, t) => [String(v), `out of ${num(t)} in the known answers`]],
  ['silent_victim_precision_exact_tier', 'Customers named who were really affected', (v, t) => [pct(v), `target ${pct(num(t))} or more`]],
  ['grants_that_ground_truth_says_were_not_owed', 'Access given to someone not owed it', (v) => [String(v), 'target none']],
  ['never_ask_violations_in_agent_replies', 'Replies that asked for a password, card or OTP', (v) => [String(v), 'target none']],
  ['silent_to_complained_ratio', 'Customers who never wrote in, for each one who did (webhook issue)', (v, t) => [v.toFixed(1), `we stop if it falls under ${num(t)}`]],
  ['alert_latency_minutes_from_deploy', 'Minutes from the release to the alert (webhook issue)', (v) => [`${Math.round(v)} min`, 'when the first customer was hit']],
  ['zone1_inc4_minutes_from_start_to_alert', 'Minutes from the pay page breaking to the alert (pay page issue)', (v) => [`${Math.round(v)} min`, 'with the pay-page check switched on']],
  ['identified_within_3_questions_cooperative', 'Customers whose payment was found in 3 questions', (v) => [pct(v), 'on scripted, friendly threads']],
]

// Amounts here are in rupees and paise (the cost per case is under a rupee), so this helper is used in place of rupees(), which rounds to whole rupees.
// What the product asks of a founder and what it costs: the PRD's north star and cost metrics. Values come from the report. The wording, and the one assumption
// behind the minutes (30 seconds per approval), are said on the card.
const money = (x: number) => `₹${x.toFixed(2)}`
const minutes = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(1)} min`

// "How we know it works": every number here comes from comparing the pipeline with hidden ground truth in a synthetic world.
export default function How() {
  const { data, error } = useGet<Schemas['EvalReport']>('/api/eval/report')
  const [all, setAll] = useState(false)
  const nav = useNavigate()
  if (error) return <Text color="feedback.text.negative.intense">Could not load the report: {error}</Text>
  if (!data) return <PageSkeleton />
  const gates = data.metrics.filter((m) => m.status === 'pass' || m.status === 'fail')
  const passed = gates.filter((g) => g.status === 'pass').length
  const reported = data.metrics.length - gates.length
  const byName = (n: string) => data.metrics.find((x) => x.name === n)
  const typical = byName('founder_minutes_typical_incident_estimate')
  const cost = byName('cost_per_resolved_case_inr_messages_only')
  const reply = byName('median_seconds_to_first_reply_engine_only')
  const longest = byName('founder_minutes_inc2_estimate')
  const messy = rulesData(data.metrics)
  const perApproval = `${typical?.target.match(/(\d+) s per approval/)?.[1] ?? '?'} s`  // the assumption is written in the metric's own target text
  const effort = typical && cost && reply ? { typical, cost, reply, longest: longest ? `${minutes(longest.value ?? 0)} for the refunds` : 'n/a', longestNote: 'each one approved one customer at a time on purpose' } : undefined
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader guide="how" title="Accuracy" description={`Every number on these pages is tested against a made-up merchant whose real problems are known and hidden from Blindspot. That merchant is tidy, so near-perfect scores are expected here. Real traffic is messier.`} />
      {/* The answer first: the score, then four checks in plain words, then every check for anyone who wants them. */}
      <Card>
        <CardBody>
          <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} gap="spacing.5" alignItems={{ base: 'flex-start', m: 'center' }}>
            <Box width="56px" height="56px" flexShrink={0} borderRadius="medium" backgroundColor={passed === gates.length ? 'feedback.background.positive.subtle' : 'feedback.background.negative.subtle'} display="flex" alignItems="center" justifyContent="center">
              {passed === gates.length ? <CheckCircleIcon size="xlarge" color="feedback.icon.positive.intense" /> : <AlertTriangleIcon size="xlarge" color="feedback.icon.negative.intense" />}
            </Box>
            <Box display="flex" flexDirection="column" gap="spacing.1">
              <Heading as="h2" size="xlarge">{`${passed} of ${gates.length} scored checks pass`}</Heading>
              <Text color="surface.text.gray.muted">{`Each one compares Blindspot's answer with the known answers for the made-up merchant. ${reported} more are shown but not counted.`}</Text>
            </Box>
          </Box>
        </CardBody>
      </Card>
      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }} gap="spacing.5">
        {HEADLINE.map(([name, label, show]) => {
          const m = data.metrics.find((x) => x.name === name)
          if (!m || m.value === null || m.value === undefined) return null
          const [value, hint] = show(m.value, m.target)
          return <Stat key={name} label={label} value={value} hint={hint} icon={m.status === 'pass' ? CheckCircleIcon : m.status === 'fail' ? AlertTriangleIcon : ClockIcon} tone={m.status === 'pass' ? 'positive' : m.status === 'fail' ? 'negative' : 'neutral'} />
        })}
      </Box>
      {/* "Where rules fail" moved to the landing page (v3 batch 1.5, T3); its scores stay in the table below. */}
      {messy && <Text color="surface.text.gray.muted" testID="rules-moved">{`Today’s rules misread ${messy.wrong} of ${messy.total} messy complaints. `}<Link href="/how-it-works#why-ai" onClick={(e) => { e.preventDefault(); nav('/how-it-works#why-ai') }}>Why Blindspot needs an AI agent</Link></Text>}
      {effort && (
        <Box display="flex" flexDirection="column" gap="spacing.4">
          <Box display="flex" flexDirection="column">
            <Heading as="h2" size="medium">What it asks of you, and what it costs</Heading>
            <Text size="small" color="surface.text.gray.muted">Counted from Blindspot's own plans and runs. The time per approval is an estimate, not timed.</Text>
          </Box>
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
            <Stat label="Your time, typical payment issue" value={minutes(effort.typical.value ?? 0)} hint={`estimated at ${perApproval} per approval, not timed. Target ${minutes(num(effort.typical.target))} or less. Longest: ${effort.longest}, ${effort.longestNote}`} icon={ClockIcon} tone={effort.typical.status === 'pass' ? 'positive' : 'negative'} />
            <Stat label="Cost per resolved case" value={money(effort.cost.value ?? 0)} hint="messages only. No model is used here, and a model would add its own cost" icon={CheckCircleIcon} />
            <Stat label="Time to first reply" value={(effort.reply.value ?? 0) < 1 ? 'Under 1 second' : `${(effort.reply.value ?? 0).toFixed(1)} s`} hint="engine only, no network. A model call adds a few seconds" icon={ClockIcon} tone={effort.reply.status === 'pass' ? 'positive' : 'negative'} />
          </Box>
        </Box>
      )}
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
                    <TableCell><Text color="surface.text.gray.subtle">{sentence(m.name).replace(/^Day0 /, 'First check ')}</Text></TableCell>
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
