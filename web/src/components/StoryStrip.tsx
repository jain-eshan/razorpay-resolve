import { Box, Card, CardBody, CheckCircleIcon, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { OWNER, sentence } from '../lib/format'
import { Pulse } from './Pulse'

type Inc = Pick<Schemas['IncidentDetail'], 'status' | 'affected' | 'complained' | 'silent' | 'tier_counts' | 'owner' | 'actions'> & { verdict: Pick<Schemas['IncidentDetail']['verdict'], 'confidence'> }

// How many customers Blindspot has told so far, and how many of them paid again: read from the actions already sent. A message counts once it is approved and delivered
// (`verified`); a pay-again link counts once sent. Reverted and drafted work counts for nothing.
const reached = (actions: Inc['actions']) => ({
  told: actions.reduce((n, a) => n + (a.action_type === 'message' ? a.item_counts.verified ?? 0 : a.action_type === 'recovery_link' ? a.item_counts.sent ?? 0 : 0), 0),
  paid: actions.reduce((n, a) => n + (a.action_type === 'recovery_link' ? a.item_counts.sent_paid ?? 0 : 0), 0),
})

// Put right by Blindspot, read from the actions you approved, never from customers who sorted it out without it (PRD v3: no recovery is claimed for a customer who came back
// on their own). Access given back (grant) and second charges refunded count once confirmed (`verified`); a pay-again link counts only once the customer paid through it.
// The actions of one issue all work on the same customers (on a renewal issue the link goes to customers whose access was already kept on), so the largest count is the
// number of customers, never the sum.
const putRight = (actions: Inc['actions']) => Math.max(0, ...actions.map((a) =>
  a.action_type === 'grant' || a.action_type === 'refund' ? a.item_counts.verified ?? 0 : a.action_type === 'recovery_link' ? a.item_counts.sent_paid ?? 0 : 0))

// Customers who needed nothing from Blindspot, from the engine's own reason for leaving them out: they paid again on their own, or you had already given access or refunded
// them yourself. Said beside the count, never in it.
const onTheirOwn = (members: Schemas['Member'][]) => {
  const paid = members.filter((m) => /^Paid since\b/.test(m.exclusion_reason ?? '')).length
  const you = members.filter((m) => m.exclusion_reason === 'already active (manual grant)' || m.exclusion_reason === 'refunded').length
  return [paid ? `${paid} paid on their own` : '', you ? `${you} fixed by you` : ''].filter(Boolean).join(', ')
}

// The five steps every payment issue goes through, with the issue's own numbers (PRD v3, section 1): hear, find everyone, say whose side, fix, win customers back.
// Where the issue is in them is read from its data: a step is done once its numbers are in, and the first one that is not is the one it is on now.
// `members` (the customers found) says who needed nothing from Blindspot; until it loads the note shows the status only.
export function StoryStrip({ inc, members = [] }: { inc: Inc; members?: Schemas['Member'][] }) {
  const { told, paid } = reached(inc.actions)
  const closed = inc.status === 'closed'
  // The Fix step is done when nothing is left waiting for your approval (the same group counts as "still to put right" in the numbers below), or the issue is closed.
  // Its number is only what Blindspot's own actions put right, so it never claims a customer who paid again by themselves.
  const waiting = (inc.tier_counts.exact ?? 0) + (inc.tier_counts.likely ?? 0) + (inc.tier_counts.check ?? 0)
  // The note says who sorted it out on their own when anyone did, and the status otherwise. Both did not fit two lines in a tile five across, and the status is
  // already on the page twice (the tile's "now" marker and the badge at the top).
  const others = onTheirOwn(members)
  const status = closed ? 'closed' : waiting === 0 ? 'all approved' : inc.status === 'open' ? 'needs your approval' : 'in progress'
  const steps = [
    { title: 'Hear', done: true, value: inc.complained > 0 ? `${inc.complained} wrote in` : 'No complaints yet', note: inc.complained > 0 ? 'seen in your data too' : 'found in your data' },
    { title: 'Find everyone', done: true, value: `${inc.affected} customers hit`, note: inc.silent > 0 ? 'not only those who wrote in' : 'every one wrote in' },
    { title: 'Whose side', done: inc.owner !== 'unknown', value: OWNER[inc.owner], note: `${sentence(inc.verdict.confidence)} confidence` },
    { title: 'Fix', done: closed || (inc.affected > 0 && waiting === 0), value: `${putRight(inc.actions)} of ${inc.affected} put right`, note: others || status },
    { title: 'Win back', done: closed && told > 0, value: told > 0 ? `${told} told` : 'No one told yet', note: paid > 0 ? `${paid} paid again` : 'needs your approval' },
  ]
  return <StoryTiles steps={steps} />
}

export type StoryStep = { title: string; done: boolean; value: string; note: string }

// The five tiles themselves, so an issue that does not fit the engine's fields (the brand demo, where the first signal is an alert and not a complaint) can pass its own steps.
export function StoryTiles({ steps }: { steps: StoryStep[] }) {
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
                {s.done ? <Box flexShrink={0} display="flex"><CheckCircleIcon size="large" color="feedback.icon.positive.intense" /></Box> : (() => {
                  const mark = (
                    <Box width="spacing.6" height="spacing.6" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center" borderWidth={current ? 'thick' : 'thin'} borderColor={current ? 'surface.border.primary.normal' : 'surface.border.gray.normal'}>
                      <Text size="xsmall" weight="semibold" color={current ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{i + 1}</Text>
                    </Box>
                  )
                  return current ? <Pulse tone="primary">{mark}</Pulse> : mark  // the step it is on now carries the live pulse; later steps stay still
                })()}
                <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
                  <Text size="small" weight="semibold" color={current ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{current ? `${s.title} · now` : s.title}</Text>
                  <Box minHeight={{ base: 'spacing.0', m: i === 4 ? 'spacing.0' : '40px', xl: '40px' }}><Text weight="semibold">{s.value}</Text></Box>
                  {/* Where tiles sit side by side (two across from m, five from xl), two lines are always kept for the value and the note, so the strip is one height whatever the numbers
                      and words turn out to be as the fix moves on. A tile about 200px wide (two across, beside the side menu) is only just wide enough for one line, and a line that wraps on
                      one machine's font and not another's made the strip 20px taller on the last approval. On a phone the tiles stack at full width, so one line each and no empty band, and
                      the fifth tile spans both columns on a tablet, so it needs no spare line either. */}
                  <Box minHeight={{ base: 'spacing.0', m: i === 4 ? 'spacing.0' : '36px', xl: '36px' }}><Text size="small" color="surface.text.gray.muted">{s.note}</Text></Box>
                </Box>
              </Box>
            )
          })}
        </Box>
      </CardBody>
    </Card>
  )
}
