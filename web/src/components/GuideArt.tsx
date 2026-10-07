import { Box } from '@razorpay/blade/components'
import { flatArt, useFlatPalette, type ArtId } from './FlatArt'

// The picture panel on a card in a guide and in Setup, as on the product cards on Razorpay's dashboard home: a light panel inset in the card, a flat picture centred in it.
export function GuideArt({ art, height = '152px' }: { art: ArtId; height?: `${number}px` }) {
  const p = useFlatPalette()
  return (
    <Box height={height} backgroundColor="surface.background.gray.subtle" borderRadius="medium" display="flex" alignItems="center" justifyContent="center" padding="spacing.3">
      <Box height="100%" width="100%">{flatArt(art, p)}</Box>
    </Box>
  )
}
