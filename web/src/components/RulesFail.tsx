import { Box, Card, CardBody, Heading, ProgressBar, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'

type Metric = Schemas['EvalMetric']
const pct = (x: number) => `${Math.round(x * 100)}%`
// How many messages a figure is out of, when the report says (its target reads "Only the 12 tagged hinglish").
const outOf = (m?: Metric) => m?.target.match(/Only the (\d+) tagged/)?.[1] ?? m?.target.match(/of (?:the )?(\d+)/)?.[1]
const KIND: Record<string, string> = { hinglish: 'Hinglish', typo: 'Typos', two_issues: 'Two issues in one message' }
const tone = (x: number) => (x >= 0.9 ? 'positive' : x >= 0.5 ? 'notice' : 'negative')

// What each row measures, in a merchant's words. The figure and the count come from the eval report (`eval/messy.py`); only the wording is written here.
// The engine's names for what a complaint is about, in a merchant's words. The report writes them with spaces ("debited no order").
const CLAIM: [string, string][] = [['debited no access', 'paid, no access'], ['debited no order', 'paid, no order'], ['charged twice', 'charged twice'], ['refund not received', 'refund not received'],
  ['charged after cancel', 'charged after cancelling'], ['renewal failed', 'renewal failed'], ['payment failed', 'payment failed'], ['page error', 'pay page error'],
  ['checkout not opening', 'checkout would not open'], ['not about a payment', 'not about a payment']]
const plain = (t: string) => CLAIM.reduce((acc, [from, to]) => acc.replaceAll(from, to), t)

const ROWS: [string, string][] = [
  ['messy_main_claim_found_clean', 'Plain messages, one issue, the usual words'],
  ['messy_main_claim_found_forwarded', 'Forwarded emails and pasted chats'],
  ['messy_main_claim_found_hinglish', 'Hinglish'],
  ['messy_main_claim_found_typo', 'Typos and short forms'],
  ['messy_amount_found', 'The amount the customer wrote'],
  ['messy_both_issues_found', 'Both issues, when a message has two'],
]

// "Where rules fail" (Track 2: why AI beats a rule, shown with evidence instead of a claim). The rules that read complaints today are scored on made-up messy complaints,
// labelled by what the customer means. Reported, not gated: it shows where the rules stop. Nothing here is typed in: every figure and every example is from the eval run.
export function RulesFail({ metrics }: { metrics: Metric[] }) {
  const by = (n: string) => metrics.find((m) => m.name === n)
  const total = by('messy_complaints_total')?.value
  const overall = by('messy_main_claim_found')?.value
  if (!total || overall == null) return null  // an older report has no such run: show nothing rather than an empty card
  const misses = [1, 2, 3].map((i) => by(`messy_miss_${i}`)?.target.split(' | ')).filter((x): x is string[] => !!x && x.length === 4)
  return (
    <Card testID="rules-fail">
      <CardBody>
        <Box display="flex" flexDirection="column" gap="spacing.6">
          <Box display="flex" flexDirection="column" gap="spacing.2" maxWidth="720px">
            <Heading as="h2" size="medium">Where rules fail</Heading>
            <Text color="surface.text.gray.muted">{`The rules that read complaints today, tried on ${total} made-up messages written the way customers write: Hinglish, typos, forwarded text, no payment ID, two issues in one. Each is labelled by what the customer means. They read ${pct(overall)} right as the main issue. How that splits, by kind:`}</Text>
          </Box>
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(2, minmax(0, 1fr))' }} columnGap="spacing.8" rowGap="spacing.5">
            {ROWS.map(([name, label]) => {
              const m = by(name)
              if (m?.value == null) return null
              const n = outOf(m)
              return (
                <Box key={name} display="flex" flexDirection="column" gap="spacing.2" testID={`rules-row-${name}`}>
                  <Box display="flex" justifyContent="space-between" alignItems="baseline" gap="spacing.4">
                    <Text weight="semibold">{label}</Text>
                    <Text weight="semibold">{pct(m.value)}</Text>
                  </Box>
                  <ProgressBar value={Math.round(m.value * 100)} color={tone(m.value)} size="small" showPercentage={false} accessibilityLabel={`${label}: ${pct(m.value)}`} />
                  <Text size="small" color="surface.text.gray.muted">{name === 'messy_both_issues_found' ? `of ${n} two-in-one messages. The rules return one reading, so it cannot be more.` : `of ${n} messages`}</Text>
                </Box>
              )
            })}
          </Box>
          {misses.length > 0 && (
            <Box display="flex" flexDirection="column" gap="spacing.4">
              <Text weight="semibold">Where it went wrong</Text>
              <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
                {misses.map(([said, read, means, kind]) => (
                  <Box key={said} display="flex" flexDirection="column" gap="spacing.3" padding="spacing.5" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.subtle" backgroundColor="surface.background.gray.moderate">
                    <Text size="small" weight="semibold" color="surface.text.gray.muted">{KIND[kind.replace('kind: ', '')] ?? 'Other'}</Text>
                    <Text weight="semibold">{said}</Text>
                    <Text size="small" color="surface.text.gray.muted">{plain(read).replace('rules read: ', 'The rules read it as: ')}</Text>
                    <Text size="small" color="surface.text.gray.muted">{plain(means).replace('it means: ', 'It means: ')}</Text>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          <Text size="small" color="surface.text.gray.muted">The messages are made up for this test, and a set this size shows where the rules stop, not how often. No model has been run on them yet, so there is no model score here: that is the next step. In production the agent reads the message the way a person would, and the rules stay for what they do well.</Text>
        </Box>
      </CardBody>
    </Card>
  )
}
