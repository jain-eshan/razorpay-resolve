import { Box, Text } from '@razorpay/blade/components'
import { useWidth } from '../lib/useWidth'

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box display="flex" flexDirection="column" gap="spacing.1">
    <Text size="small" weight="semibold" color="surface.text.gray.muted">{label}</Text>
    {children}
  </Box>
)

// Root cause and actions, side by side when each gets about 300px and stacked below that. The room is measured, so this is its own component: it is mounted only once the page's data has
// arrived, and a measurement taken while the skeleton is showing would find no element to measure.
export function Pair({ children }: { children: React.ReactNode }) {
  const [grid, room] = useWidth<HTMLDivElement>()
  return <Box ref={grid} display="grid" gridTemplateColumns={room >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'} gap="spacing.5" alignItems="stretch" testID="root-cause-actions">{children}</Box>
}
