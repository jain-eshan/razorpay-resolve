import type { ComponentType } from 'react'
import { Box } from '@razorpay/blade/components'
import { useHeroWash } from './iso'
import { IsoHero } from './IsoHero'
import { AutonomyScene, ChannelsScene, ConversationsScene, HowScene, IncidentsScene, LearningScene, ScanScene } from './IsoScenes'

// The picture on the left of each guide's hero, by guide id (lib/guides.ts).
const SCENES: Record<string, ComponentType> = { blindspot: IsoHero, incidents: IncidentsScene, conversations: ConversationsScene, channels: ChannelsScene, scan: ScanScene, autonomy: AutonomyScene, learning: LearningScene, how: HowScene }

// The left half of a guide's hero slide, like Smart Collect's: a tinted panel with the guide's isometric picture (IsoScenes.tsx) filling it.
// A still wash, not Blade's RazorSense surface: that surface paints white until its animation starts, which hid the wash and left the picture floating on white.
export function GuideHero({ id }: { id: string }) {
  const wash = useHeroWash()
  const Scene = SCENES[id]
  return (
    <Box position="relative" height="100%" minHeight={{ base: '260px', xl: '440px' }} display="flex" alignItems="center" testID="guide-hero">
      <div style={{ position: 'absolute', inset: 0, background: wash }} />
      <Box position="relative" width="100%" padding={{ base: 'spacing.5', xl: 'spacing.4' }}>{Scene && <Scene />}</Box>
    </Box>
  )
}
