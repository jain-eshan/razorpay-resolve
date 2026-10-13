import { useState } from 'react'
import { Box, Collapsible, CollapsibleBody, CollapsibleButton, List, ListItem, ProgressBar, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { sentence } from '../lib/format'
import { justYou, PLAN } from '../lib/justYou'
import { Panel } from './Panel'

// "Is it just you?" (PRD v3, F7a): where the failures concentrate, in up to three plain sentences, strongest first, with the numbers behind them one tap away.
// It compares the affected payments with all payments on a normal day, for this merchant only. Other merchants are not compared yet, and the panel says so.
// `lines` stands in when there are no payments to compare (a customer who never reached the pay page has none): the caller passes what the engine saw instead.
// `compared` says what the affected payments were compared with, when it is not the merchant's own payments on a normal day (the brand demo compares with the half hour before the release).
export function JustYou({ inc, lines, compared }: { inc: Pick<Schemas['IncidentDetail'], 'lift'> & { verdict: Pick<Schemas['IncidentDetail']['verdict'], 'what_we_cannot_see'> }; lines?: string[]; compared?: string }) {
  const { lines: said, weak, sorted } = justYou(inc.lift)
  const none = sorted.length === 0
  const [open, setOpen] = useState(false)
  return (
    <Panel title="Is it just you?" subtitle={compared ? `${compared}. Other merchants are not compared yet` : none && lines?.length ? 'Compared with what is normal for the same hours. Other merchants are not compared yet' : 'Compared with your own payments on a normal day. Other merchants are not compared yet'} testID="just-you">
      <Box display="flex" flexDirection="column" gap="spacing.3">
        {none ? (
          lines?.length ? lines.map((t) => <Text key={t}>{t}</Text>) : <Text color="surface.text.gray.muted">There are no payments to compare for this issue, so no pattern to show.</Text>
        ) : (
          <>
            {weak && <Text size="small" color="surface.text.gray.muted">Nothing stands out. The closest pattern:</Text>}
            {said.map((t) => <Text key={t} weight="semibold">{t}</Text>)}
          </>
        )}
      </Box>
      {sorted.length > said.length && (
        // The bars are drawn only while it is open. Blade's Collapsible starts with its body in the page and folds it away, so a closed one that keeps its body jumps from tall to short on load.
        <Collapsible isExpanded={open} onExpandChange={({ isExpanded }) => setOpen(isExpanded)}>
          <CollapsibleButton variant="tertiary" size="medium">{`Show the numbers (${sorted.length} patterns checked)`}</CollapsibleButton>
          <CollapsibleBody>
            {open && <Box display="flex" flexDirection="column" paddingTop="spacing.3">
              <Text size="small" color="surface.text.gray.muted">Orange bar: share of the affected payments. Dark bar: share of all payments on a normal day.</Text>
              {sorted.map((l) => {
                const name = `${sentence(l.dimension)}: ${PLAN[l.value] ?? l.value.replace(/\bupi\b/g, 'UPI')}`
                const aff = Math.round(l.share_affected * 100), base = Number((l.share_baseline * 100).toFixed(1))
                return (
                  <Box key={l.dimension + l.value} display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap={{ base: 'spacing.2', m: 'spacing.6' }} alignItems="center" paddingY="spacing.4" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                    <Text>{name}</Text>
                    <Box display="flex" flexDirection="column" gap="spacing.2">
                      <ProgressBar value={aff} color="notice" size="medium" showPercentage={false} accessibilityLabel={`${name}: ${aff}% of affected`} />
                      <ProgressBar value={base} color="neutral" size="medium" showPercentage={false} accessibilityLabel={`${name}: ${base}% normally`} />
                      <Text size="small" color="surface.text.gray.muted">{aff}% of affected vs {base}% normally</Text>
                    </Box>
                  </Box>
                )
              })}
            </Box>}
          </CollapsibleBody>
        </Collapsible>
      )}
      {/* Said once per page, here on every issue page: one label and the caveats as a short list, not the label repeated before each caveat. */}
      {inc.verdict.what_we_cannot_see.length > 0 && (
        <Box display="flex" flexDirection="column" gap="spacing.2" paddingTop="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" testID="cannot-see">
          <Text size="small" weight="semibold" color="surface.text.gray.subtle">What Resolve cannot see</Text>
          <List size="small">{inc.verdict.what_we_cannot_see.map((s) => <ListItem key={s}>{s}</ListItem>)}</List>
        </Box>
      )}
    </Panel>
  )
}
