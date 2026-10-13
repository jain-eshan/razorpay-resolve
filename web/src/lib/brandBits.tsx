import { Box, Text } from '@razorpay/blade/components'

export const n = (x: number) => x.toLocaleString('en-IN')
// A value with a muted line under it, as on the other issue pages.
export const two = (top: string, bottom: string) => (
  <Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{top}</Text><Text size="small" color="surface.text.gray.muted">{bottom}</Text></Box>
)
