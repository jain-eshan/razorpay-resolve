import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { cause, sentence } from '../lib/format'
import { useWidth } from '../lib/useWidth'
import { Panel } from './Panel'
import { StartFix } from './StartFix'

const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'neutral', bank: 'neutral', customer: 'neutral', unknown: 'neutral' } as const
type Inc = Pick<Schemas['IncidentDetail'], 'id' | 'title' | 'owner' | 'inferred' | 'status' | 'mismatch_type' | 'tier_counts'> & { verdict: Pick<Schemas['IncidentDetail']['verdict'], 'confidence'> }

// What Blindspot would do, in a line, for each kind of issue, and for how many customers. Only what is waiting counts: customers already put right are not in `exact`.
const WOULD: Record<string, (n: number) => string> = {
  A: (n) => `Give ${n} customers their access back, in steps`,
  E: (n) => `Refund ${n} second charges to the original payment method, one customer at a time`,
  G: (n) => `Keep access on for ${n} customers while Razorpay fixes it`,
  Z1: (n) => `Send ${n} customers a link to pay again`,
}
// The engine writes a release as "app_release android-3.4.1"; a merchant reads "Release android-3.4.1".
const plainChange = (c: string) => c.replace(/^app_release /, 'Release ')
// What happens at each step, said as it is: refunds go out one customer at a time and have no "first 5" stage; the other fixes go in steps.
const HOW: Record<string, string> = {
  E: 'Each refund goes to the original payment method, one customer at a time, and you approve each one. A message to the customers needs your approval too.',
}
const STEPS = 'Each step starts with a test run, then the first 5, then the rest. Nothing happens until you approve it, and messages to customers need your approval too.'
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box display="flex" flexDirection="column" gap="spacing.1">
    <Text size="small" weight="semibold" color="surface.text.gray.muted">{label}</Text>
    {children}
  </Box>
)

// The two cards under the evidence on an issue page (wireframe 3): the root cause, then the actions that wait for approval. The page's one blue button is in the actions card.
// The cause, the change and the fix are the engine's (the evidence pack); nothing here is typed in. The page loads the pack with the incident, so this card never grows
// when it arrives; `pack` is missing only when it failed to load.
export function RootCauseActions({ inc, pack, fix, closed }: { inc: Inc; pack?: Schemas['EvidencePack']; fix: RefObject<HTMLDivElement>; closed: boolean }) {
  const nav = useNavigate()
  // Side by side only when each card gets about 300px: the column is not the window (the timeline can sit beside it), so the room is measured, not guessed from the screen.
  const [grid, room] = useWidth<HTMLDivElement>()
  const waiting = inc.tier_counts.exact ?? 0
  const finished = closed || waiting === 0  // nothing left to approve, whether or not the issue has been marked closed yet
  const razorpay = !!pack?.for_razorpay
  return (
    <Box ref={grid} display="grid" gridTemplateColumns={room >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'} gap="spacing.5" alignItems="stretch" testID="root-cause-actions">
      <Panel title="Root cause" fill>
        <Field label="Cause"><Text>{inc.title}</Text></Field>
        {!pack ? (
          <Text size="small" color="surface.text.gray.muted">The suggested fix could not be loaded.</Text>
        ) : (
          <>
            {pack.linked_change && !inc.title.includes(pack.linked_change) && <Field label="What changed"><Text>{plainChange(pack.linked_change)}</Text></Field>}
            <Field label={razorpay ? 'What to do' : 'The fix'}><Text>{pack.suggested_fix}</Text></Field>
          </>
        )}
        <Field label="Whose side">
          <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap">
            <Badge size="medium" color={OWNER_TONE[inc.owner]}>{cause(inc)}</Badge>
            <Text size="small" color="surface.text.gray.muted">{`${sentence(inc.verdict.confidence)} confidence`}</Text>
          </Box>
        </Field>
      </Panel>
      <Panel title="Actions, need your approval" fill>
        {finished ? <Text>{closed ? 'Everything was approved and done. The steps are kept below.' : 'Nothing is waiting for you. Every customer has been put right.'}</Text> : (
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Text>{(WOULD[inc.mismatch_type] ?? ((n: number) => `Put right ${n} customers`))(waiting)}</Text>
            <Text size="small" color="surface.text.gray.muted">{HOW[inc.mismatch_type] ?? STEPS}</Text>
          </Box>
        )}
        <Box display="flex" flexDirection="column" gap="spacing.3" marginTop="auto">
          <StartFix to={fix} closed={finished} />
          <Button variant="secondary" size="medium" isFullWidth onClick={() => nav(`/incidents/${inc.id}/dev`)}>{razorpay ? 'Open the evidence pack' : 'Send to your developer'}</Button>
        </Box>
      </Panel>
    </Box>
  )
}
