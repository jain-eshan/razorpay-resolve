import type { ReactNode } from 'react'
import { Box, Card, CardBody, CheckIcon, CloseIcon, Heading, Skeleton, Text } from '@razorpay/blade/components'
import type { RulesData } from '../lib/rulesData'
import { useWidth } from '../lib/useWidth'

const KIND: Record<string, string> = { hinglish: 'Hinglish', typo: 'Typos', two_issues: 'Two problems in one message' }

// The engine's names for what a complaint is about, in a merchant's words. The report writes them with spaces ("debited no order").
const CLAIM: [string, string][] = [['debited no access', 'paid, no access'], ['debited no order', 'paid, no order'], ['charged twice', 'charged twice'], ['refund not received', 'refund not received'],
  ['charged after cancel', 'charged after cancelling'], ['renewal failed', 'renewal failed'], ['payment failed', 'payment failed'], ['page error', 'pay page error'],
  ['checkout not opening', 'checkout would not open'], ['not about a payment', 'not about a payment']]
const plain = (t: string) => CLAIM.reduce((acc, [from, to]) => acc.replaceAll(from, to), t)

// From this width the figures panel sits beside the words and the three examples go three across (a card then has about 240px for its quote); below, they stack.
const SIDE = 760

// Every block in the card keeps one size whether the report has arrived or not (DESIGN.md section 23 B2). While loading, the same words are laid out hidden, with figures
// as placeholders, and a skeleton sits over them; nothing on screen shows a placeholder figure. Text from the data that can run long (a customer's message, a reading) is
// held to a fixed number of lines: `Lines` stacks that many hidden lines in the same grid cell, so the cell is that tall whether the text is shorter or missing.
function Slot({ loading, children }: { loading: boolean; children: ReactNode }) {
  if (!loading) return <>{children}</>
  return (
    <Box position="relative">
      <Box visibility="hidden">{children}</Box>
      <Skeleton position="absolute" top="spacing.0" left="spacing.0" width="100%" height="100%" borderRadius="medium" />
    </Box>
  )
}
type TextSize = 'small' | 'medium' | 'large'
function Lines({ n, size, weight, muted, loading, children }: { n: number; size: TextSize; weight?: 'semibold'; muted?: boolean; loading: boolean; children?: string }) {
  return (
    <Box display="grid" position="relative">
      <Box gridArea="1 / 1 / 2 / 2" visibility="hidden" display="flex" flexDirection="column">{Array.from({ length: n }, (_, i) => <Text key={i} size={size} weight={weight}>x</Text>)}</Box>
      {loading ? <Skeleton position="absolute" top="spacing.0" left="spacing.0" width="100%" height="100%" borderRadius="medium" /> : <Box gridArea="1 / 1 / 2 / 2"><Text size={size} weight={weight} color={muted ? 'surface.text.gray.muted' : undefined} truncateAfterLines={n}>{children}</Text></Box>}
    </Box>
  )
}

// "Why an AI agent" on How Blindspot works (Track 2's question: why does AI beat a rule). The point first: how often today's rules misread a messy complaint and how many
// more they read only in part, then three real examples. Every figure and every quote is read from the eval report (`eval/messy.py`, `eval/messy_complaints.json`); only
// the wording is here. Accuracy keeps the full scores. Without `data` it draws its loading frame, the same size.
export function RulesFail({ data }: { data?: RulesData }) {
  const [ref, room] = useWidth<HTMLDivElement>()
  const loading = !data
  const d = data ?? { total: 0, wrong: 0, twoN: 0, partial: 0, twoBoth: 0, misses: [] }
  const shown = loading ? 3 : d.misses.length  // the report carries three examples; the frame is laid out for three
  const side = room >= SIDE
  const lines = side ? 3 : 4  // a quote's lines: three in a third of a wide card, four when the cards stack (the longest quote takes three at 375px)
  const lead = !loading && d.wrong === 0 ? 'Today’s rules read every messy complaint right' : `Today’s rules misread about 1 in ${loading ? 7 : Math.round(d.total / d.wrong)} messy complaints`
  const half = d.twoN - d.twoBoth
  const two = loading || d.twoN ? ` In ${loading || d.twoBoth === 0 ? `each of the ${loading ? 5 : d.twoN}` : `${half} of the ${d.twoN}`} with two problems, they caught one and missed the other.` : ''
  return (
    <Card testID="rules-fail">
      <CardBody>
        <Box ref={ref} display="flex" flexDirection="column" gap="spacing.7" testID={loading ? 'rules-loading' : 'rules-loaded'}>
          <Box display="grid" gridTemplateColumns={side ? 'minmax(0, 3fr) minmax(0, 2fr)' : 'minmax(0, 1fr)'} gap="spacing.7" alignItems="center">
            <Box display="flex" flexDirection="column" gap="spacing.4">
              <Slot loading={loading}><Heading as="h3" size="large">{lead}</Heading></Slot>
              <Slot loading={loading}><Text color="surface.text.gray.subtle">{`The rules that sort complaints today were tried on ${loading ? 41 : d.total} made-up messages, written the way customers write: Hinglish, typos, two problems in one.${two}`}</Text></Slot>
            </Box>
            <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="spacing.5" padding="spacing.6" borderRadius="medium" backgroundColor="surface.background.gray.moderate" testID="rules-stat">
              <Box display="flex" flexDirection="column" gap="spacing.1">
                <Slot loading={loading}><Heading as="span" size="xlarge">{loading ? '00 of 00' : `${d.wrong} of ${d.total}`}</Heading></Slot>
                <Text size="small" color="surface.text.gray.muted">messy complaints misread</Text>
              </Box>
              <Box display="flex" flexDirection="column" gap="spacing.1">
                <Slot loading={loading}><Heading as="span" size="xlarge">{loading ? '0 more' : `${d.partial} more`}</Heading></Slot>
                <Text size="small" color="surface.text.gray.muted">read only in part</Text>
              </Box>
            </Box>
          </Box>
          {shown > 0 && (
            <Box display="flex" flexDirection="column" gap="spacing.4">
              <Text weight="semibold">{`${shown === 3 ? 'Three' : shown === 2 ? 'Two' : 'One'} the rules got wrong or half right`}</Text>
              <Box display="grid" gridTemplateColumns={side ? `repeat(${shown}, minmax(0, 1fr))` : 'minmax(0, 1fr)'} gap="spacing.5">
                {Array.from({ length: shown }, (_, i) => {
                  const [said, read, means, kind] = d.misses[i] ?? ['', '', '', '']
                  return (
                    <Box key={i} display="flex" flexDirection="column" gap="spacing.4" padding="spacing.5" borderRadius="medium" backgroundColor="surface.background.gray.moderate" testID="rules-miss">
                      <Lines n={1} size="small" weight="semibold" muted loading={loading}>{KIND[kind.replace('kind: ', '')] ?? 'Other'}</Lines>
                      <Lines n={lines} size="large" weight="semibold" loading={loading}>{said.replace(/^"/, '“').replace(/"$/, '”')}</Lines>
                      <Box display="flex" flexDirection="column" gap="spacing.2">
                        <Box display="flex" alignItems="flex-start" gap="spacing.3">
                          <Box flexShrink={0} paddingTop="spacing.1" display="flex"><CloseIcon size="small" color="feedback.icon.negative.intense" /></Box>
                          <Box flexGrow={1} minWidth="spacing.0"><Lines n={2} size="small" loading={loading}>{`Rules read it as: ${plain(read.replace('rules read: ', ''))}`}</Lines></Box>
                        </Box>
                        <Box display="flex" alignItems="flex-start" gap="spacing.3">
                          <Box flexShrink={0} paddingTop="spacing.1" display="flex"><CheckIcon size="small" color="feedback.icon.positive.intense" /></Box>
                          <Box flexGrow={1} minWidth="spacing.0"><Lines n={2} size="small" loading={loading}>{`The customer means: ${plain(means.replace('it means: ', ''))}`}</Lines></Box>
                        </Box>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}
          <Text size="small" color="surface.text.gray.muted">The messages are made up for this test. No AI model has been tried on them yet: that is the next build.</Text>
        </Box>
      </CardBody>
    </Card>
  )
}
