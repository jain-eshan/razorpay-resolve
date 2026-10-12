import { Box, Card, CardBody, CheckCircleIcon, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { OWNER, sentence } from '../lib/format'

type Inc = Pick<Schemas['IncidentDetail'], 'status' | 'affected' | 'complained' | 'silent' | 'tier_counts' | 'owner' | 'actions'> & { verdict: Pick<Schemas['IncidentDetail']['verdict'], 'confidence'> }

// How many customers Blindspot has told so far, and how many of them paid again: read from the actions already sent. A message counts once it is approved and delivered
// (`verified`); a pay-again link counts once sent. Reverted and drafted work counts for nothing.
const reached = (actions: Inc['actions']) => ({
  told: actions.reduce((n, a) => n + (a.action_type === 'message' ? a.item_counts.verified ?? 0 : a.action_type === 'recovery_link' ? a.item_counts.sent ?? 0 : 0), 0),
  paid: actions.reduce((n, a) => n + (a.action_type === 'recovery_link' ? a.item_counts.sent_paid ?? 0 : 0), 0),
})

// The five steps every payment issue goes through, with the issue's own numbers (PRD v3, section 1): hear, find everyone, say whose side, fix, win customers back.
// Where the issue is in them is read from its data: a step is done once its numbers are in, and the first one that is not is the one it is on now.
export function StoryStrip({ inc }: { inc: Inc }) {
  const { told, paid } = reached(inc.actions)
  const closed = inc.status === 'closed'
  // Put right = everyone in the count who no longer needs anything from you: already active, refunded, handled by hand, or fixed here. It is read from the same group
  // counts as "still to put right" in the numbers below, so the two never disagree (the engine's own `fixed` is a fixed field and does not move as the fix goes on).
  const waiting = (inc.tier_counts.exact ?? 0) + (inc.tier_counts.likely ?? 0) + (inc.tier_counts.check ?? 0)
  const fixed = Math.max(0, inc.affected - waiting)
  const steps = [
    { title: 'Hear', done: true, value: inc.complained > 0 ? `${inc.complained} wrote in` : 'No complaints yet', note: inc.complained > 0 ? 'seen in your data too' : 'found in your data' },
    { title: 'Find everyone', done: true, value: `${inc.affected} customers hit`, note: inc.silent > 0 ? 'not only those who wrote in' : 'every one wrote in' },
    { title: 'Whose side', done: inc.owner !== 'unknown', value: OWNER[inc.owner], note: `${sentence(inc.verdict.confidence)} confidence` },
    { title: 'Fix', done: closed || (inc.affected > 0 && waiting === 0), value: `${fixed} of ${inc.affected} put right`, note: closed ? 'closed' : inc.status === 'open' ? 'needs your approval' : 'in progress' },
    { title: 'Win back', done: closed && told > 0, value: told > 0 ? `${told} told` : 'No one told yet', note: paid > 0 ? `${paid} paid again` : 'needs your approval' },
  ]
  const now = steps.findIndex((s) => !s.done)  // -1 once every step is done
  return (
    <Card testID="story-strip">
      <CardBody>
        {/* Five across from xl, two across from m, one on a phone. Every tile reads a number and a line, so the row is one height whatever the numbers are. */}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }} gap="spacing.4">
          {steps.map((s, i) => {
            const current = i === now
            return (
              <Box key={s.title} display="flex" alignItems="flex-start" gap="spacing.3" padding="spacing.4" borderRadius="medium" borderWidth="thin" testID={`story-${i + 1}`} gridColumn={{ base: 'auto', m: i === 4 ? 'span 2' : 'auto', xl: 'auto' }}
                borderColor={current ? 'surface.border.primary.muted' : 'surface.border.gray.subtle'} backgroundColor={s.done ? 'surface.background.gray.moderate' : 'surface.background.gray.intense'}>
                {s.done ? <Box flexShrink={0} display="flex"><CheckCircleIcon size="large" color="feedback.icon.positive.intense" /></Box> : (
                  <Box width="spacing.6" height="spacing.6" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center" borderWidth={current ? 'thick' : 'thin'} borderColor={current ? 'surface.border.primary.normal' : 'surface.border.gray.normal'}>
                    <Text size="xsmall" weight="semibold" color={current ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{i + 1}</Text>
                  </Box>
                )}
                <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
                  <Text size="small" weight="semibold" color={current ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{current ? `${s.title} · now` : s.title}</Text>
                  <Box minHeight={{ base: 'spacing.0', xl: '40px' }}><Text weight="semibold">{s.value}</Text></Box>
                  {/* Where five tiles sit across (xl), two lines are always kept for the value and the note, so the strip is one height whatever the numbers and words turn out to be as the fix
                      moves on. Below that the tiles are wide enough for one line each and stack tight, with the fifth across both columns on a tablet, so there is no empty band. */}
                  <Box minHeight={{ base: 'spacing.0', xl: '36px' }}><Text size="small" color="surface.text.gray.muted">{s.note}</Text></Box>
                </Box>
              </Box>
            )
          })}
        </Box>
      </CardBody>
    </Card>
  )
}
