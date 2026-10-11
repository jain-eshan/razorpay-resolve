import { Box, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { plainTokens, when } from '../lib/format'

// The engine counts attempts without a singular, so "1 webhook attempts, each answered 200" is fixed here.
const one = (t: string) => t.replace(/\b1 webhook attempts, each answered/, '1 webhook attempt, answered')

export function Lane({ title, items, empty = 'Nothing' }: { title: string; items: Schemas['LaneEvent'][]; empty?: string }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="200px">
      <Text size="small" weight="semibold">{title}</Text>
      {items.length === 0 && <Text size="small" color="surface.text.gray.muted">{empty}</Text>}
      {[...items].sort((a, b) => a.at.localeCompare(b.at)).map((e) => (
        <Text key={e.source_ref + e.text} size="small">{when(e.at)} · {one(plainTokens(e.text))}</Text>
      ))}
    </Box>
  )
}
