import { Box, Skeleton, Text, VisuallyHidden } from '@razorpay/blade/components'

// What a page shows while its data loads: grey shapes where the title, a row of figures and the first card will be, so nothing jumps when the data
// arrives (web/DESIGN.md section 15). Blade's Skeleton does the pulse.
export function PageSkeleton() {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" testID="page-loading">
      <VisuallyHidden><Text>Loading</Text></VisuallyHidden>
      <Box display="flex" flexDirection="column" gap="spacing.3">
        <Skeleton width="min(320px, 70%)" height="36px" borderRadius="medium" />
        <Skeleton width="min(560px, 90%)" height="16px" borderRadius="medium" />
      </Box>
      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
        {[0, 1, 2].map((i) => <Skeleton key={i} height="96px" borderRadius="large" />)}
      </Box>
      <Skeleton height="320px" borderRadius="large" />
    </Box>
  )
}
