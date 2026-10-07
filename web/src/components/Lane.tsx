import { Box, Text } from '@razorpay/blade/components'
import type { Schemas } from '../lib/api'
import { when } from '../lib/format'

export function Lane({ title, items }: { title: string; items: Schemas['LaneEvent'][] }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="200px">
      <Text size="small" weight="semibold">{title}</Text>
      {items.length === 0 && <Text size="small" color="surface.text.gray.muted">Nothing</Text>}
      {[...items].sort((a, b) => a.at.localeCompare(b.at)).map((e) => (
        <Text key={e.source_ref + e.text} size="small">{when(e.at)} · {e.text}</Text>
      ))}
    </Box>
  )
}
