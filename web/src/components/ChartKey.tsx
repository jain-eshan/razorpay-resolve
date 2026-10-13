import { Box, Text, useTheme } from '@razorpay/blade/components'

export type ChartColor = 'purple' | 'gold' | 'skyBlue' | 'pink' | 'gray' | 'orange' | 'green' | 'red' | 'blue'

// A small square in a chart colour. Blade's Box takes only surface and overlay colours (it throws on a data colour), so this one plain span reads the chart's colour from
// the theme token, which is what Blade's own legend does inside the chart. The colour is the token's, not typed here.
export function Swatch({ color }: { color: ChartColor }) {
  const { theme } = useTheme()
  return <span aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0, width: 8, height: 8, borderRadius: 2, background: theme.colors.data.background.categorical[color].intense }} />
}

// The key under a chart: 12px text on tight lines, centred, a colour square beside each name. Blade's own legend takes a 44px row per line in 14px text and its size cannot
// be changed, which left gaps wider than the words. Every chart on the incident pages and the Overview uses this one, so they read alike.
// `notes` are moments with no room for a line and its label on the chart (too close to another mark, or to the edge): they are said here instead, with their time.
export function ChartKey({ items, testID, notes = [] }: { items: { name: string; color: ChartColor }[]; testID?: string; notes?: string[] }) {
  return (
    <Box testID={testID ?? 'chart-legend'} display="flex" flexDirection="column" alignItems="center" gap="spacing.1">
      <Box display="flex" flexWrap="wrap" justifyContent="center" columnGap="spacing.5" rowGap="spacing.1">
        {items.map((i) => (
          <Box key={i.name} display="flex" alignItems="center" gap="spacing.2">
            <Swatch color={i.color} />
            <Text size="small" color="surface.text.gray.muted">{i.name}</Text>
          </Box>
        ))}
      </Box>
      {notes.length > 0 && <Text size="small" color="surface.text.gray.muted" textAlign="center">{`Too close to mark on the chart: ${notes.join(' · ')}`}</Text>}
    </Box>
  )
}
