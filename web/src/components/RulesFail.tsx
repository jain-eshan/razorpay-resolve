import { Box, Card, CardBody, CheckIcon, CloseIcon, Heading, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { useWidth } from '../lib/useWidth'

type Metric = Schemas['EvalMetric']
// How many messages a figure is out of, as the report says it ("Both issues of 5 two-in-one messages").
const outOf = (m?: Metric) => Number(m?.target.match(/Only the (\d+) tagged/)?.[1] ?? m?.target.match(/of (?:the )?(\d+)/)?.[1] ?? 0)
const KIND: Record<string, string> = { hinglish: 'Hinglish', typo: 'Typos', two_issues: 'Two problems in one message' }

// The engine's names for what a complaint is about, in a merchant's words. The report writes them with spaces ("debited no order").
const CLAIM: [string, string][] = [['debited no access', 'paid, no access'], ['debited no order', 'paid, no order'], ['charged twice', 'charged twice'], ['refund not received', 'refund not received'],
  ['charged after cancel', 'charged after cancelling'], ['renewal failed', 'renewal failed'], ['payment failed', 'payment failed'], ['page error', 'pay page error'],
  ['checkout not opening', 'checkout would not open'], ['not about a payment', 'not about a payment']]
const plain = (t: string) => CLAIM.reduce((acc, [from, to]) => acc.replaceAll(from, to), t)

// Below this width the stat panel goes under the words and the three misreads stack (a misread card needs about 240px for its quote).
const SIDE = 760

// "Why an AI agent" on How Blindspot works (Track 2's question: why does AI beat a rule). The point first: how often today's rules misread a messy complaint. Then three real
// misreads, then what the agent does in production. Every figure and every quote is read from the eval report (`eval/messy.py`, `eval/messy_complaints.json`); only the
// wording is here. Accuracy keeps the full scores.
export function RulesFail({ metrics }: { metrics: Metric[] }) {
  const [ref, room] = useWidth<HTMLDivElement>()
  const by = (n: string) => metrics.find((m) => m.name === n)
  const total = by('messy_complaints_total')?.value
  const overall = by('messy_main_claim_found')?.value
  if (!total || overall == null) return null  // an older report has no such run: show nothing rather than an empty card
  const wrong = Math.round(total * (1 - overall))
  const two = by('messy_both_issues_found')
  const twoN = outOf(two)
  const twoBoth = Math.round((two?.value ?? 0) * twoN)
  const misses = [1, 2, 3].map((i) => by(`messy_miss_${i}`)?.target.split(' | ')).filter((x): x is string[] => !!x && x.length === 4)
  const side = room >= SIDE
  const lead = wrong === 0 ? 'Today’s rules read every messy complaint right' : `Today’s rules misread about 1 in ${Math.round(total / wrong)} messy complaints`
  return (
    <Card testID="rules-fail">
      <CardBody>
        <Box ref={ref} display="flex" flexDirection="column" gap="spacing.7">
          <Box display="grid" gridTemplateColumns={side ? 'minmax(0, 3fr) minmax(0, 2fr)' : 'minmax(0, 1fr)'} gap="spacing.7" alignItems="center">
            <Box display="flex" flexDirection="column" gap="spacing.4">
              <Heading as="h3" size="large">{lead}</Heading>
              <Text color="surface.text.gray.subtle">{`The rules that sort complaints today were tried on ${total} made-up messages, written the way customers write: Hinglish, typos, two problems in one.${twoN ? ` In ${twoBoth === 0 ? `all ${twoN}` : `${twoN - twoBoth} of the ${twoN}`} messages with two problems, they caught only one.` : ''}`}</Text>
              <Text color="surface.text.gray.subtle">In production an AI agent reads each message the way a person would, then hands what it read to the same rules. The rules still produce every number and gate every action.</Text>
            </Box>
            <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="spacing.5" padding="spacing.6" borderRadius="medium" backgroundColor="surface.background.gray.moderate" testID="rules-stat">
              <Box display="flex" flexDirection="column" gap="spacing.1">
                <Heading as="span" size="xlarge">{`${wrong} of ${total}`}</Heading>
                <Text size="small" color="surface.text.gray.muted">messy complaints misread</Text>
              </Box>
              {twoN > 0 && (
                <Box display="flex" flexDirection="column" gap="spacing.1">
                  <Heading as="span" size="xlarge">{`${twoBoth} of ${twoN}`}</Heading>
                  <Text size="small" color="surface.text.gray.muted">two-problem messages read in full</Text>
                </Box>
              )}
            </Box>
          </Box>
          {misses.length > 0 && (
            <Box display="flex" flexDirection="column" gap="spacing.4">
              <Text weight="semibold">{`${misses.length === 3 ? 'Three' : misses.length === 2 ? 'Two' : 'One'} it got wrong`}</Text>
              <Box display="grid" gridTemplateColumns={side ? `repeat(${misses.length}, minmax(0, 1fr))` : 'minmax(0, 1fr)'} gap="spacing.5">
                {misses.map(([said, read, means, kind]) => (
                  <Box key={said} display="flex" flexDirection="column" gap="spacing.4" padding="spacing.5" borderRadius="medium" backgroundColor="surface.background.gray.moderate" testID="rules-miss">
                    <Text size="small" weight="semibold" color="surface.text.gray.muted">{KIND[kind.replace('kind: ', '')] ?? 'Other'}</Text>
                    <Text size="large" weight="semibold">{said.replace(/^"/, '“').replace(/"$/, '”')}</Text>
                    <Box display="flex" flexDirection="column" gap="spacing.2" marginTop="auto">
                      <Box display="flex" alignItems="flex-start" gap="spacing.3">
                        <Box flexShrink={0} paddingTop="spacing.1" display="flex"><CloseIcon size="small" color="feedback.icon.negative.intense" /></Box>
                        <Text size="small">{`Rules read it as: ${plain(read.replace('rules read: ', ''))}`}</Text>
                      </Box>
                      <Box display="flex" alignItems="flex-start" gap="spacing.3">
                        <Box flexShrink={0} paddingTop="spacing.1" display="flex"><CheckIcon size="small" color="feedback.icon.positive.intense" /></Box>
                        <Text size="small">{`The customer means: ${plain(means.replace('it means: ', ''))}`}</Text>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          <Text size="small" color="surface.text.gray.muted">The messages are made up for this test. No AI model has been tried on them yet: that is the next build.</Text>
        </Box>
      </CardBody>
    </Card>
  )
}
