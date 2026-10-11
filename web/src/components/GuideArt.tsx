import { Box } from '@razorpay/blade/components'
import { ART, type ArtId } from '../lib/art'
import { useHeroWash } from './iso'

// The picture panel on a card in a guide, the welcome pop-up and an empty state, as on the product cards on Razorpay's dashboard home: a light panel
// inset in the card, the picture filling it. Pictures are images (lib/art.ts); Blade has no image component, so this is a plain <img>.
// Every panel sits on the same mint-to-blue wash, so pictures with and without their own background look alike.
export function GuideArt({ art, height = '152px' }: { art: ArtId; height?: `${number}px` | '100%' }) {
  const wash = useHeroWash()
  const a = ART[art]
  return (
    <Box position="relative" height={height} borderRadius="medium" overflow="hidden">
      <div style={{ position: 'absolute', inset: 0, background: wash }} />
      <img src={a.src} alt={a.alt} loading="lazy" style={{ position: 'relative', display: 'block', width: '100%', height: '100%', objectFit: a.tall ? 'contain' : 'cover' }} />
    </Box>
  )
}
