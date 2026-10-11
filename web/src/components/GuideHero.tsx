import { Box } from '@razorpay/blade/components'
import { HERO, type HeroId } from '../lib/art'
import { useHeroWash } from './iso'

// The left half of a guide's hero slide, like Smart Collect's: a tinted panel with the guide's picture (lib/art.ts) filling it.
// A still wash, not Blade's RazorSense surface: that surface paints white until its animation starts, which hid the wash and left the picture floating on white.
export function GuideHero({ id }: { id: string }) {
  const wash = useHeroWash()
  const h = HERO[id as HeroId]
  return (
    <Box position="relative" height="100%" minHeight={{ base: '260px', xl: '440px' }} display="flex" alignItems="center" testID="guide-hero">
      <div style={{ position: 'absolute', inset: 0, background: wash }} />
      {h && <Box position="relative" width="100%" padding={{ base: 'spacing.5', xl: 'spacing.4' }}><img src={h.src} alt={h.alt} style={{ display: 'block', width: '100%', height: 'auto' }} /></Box>}
    </Box>
  )
}
