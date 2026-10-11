import { useTheme } from '@razorpay/blade/components'

// The soft mint-to-blue wash behind every picture (guide heroes, card panels, the welcome pop-up, the first check), from Blade tokens.
export function useHeroWash() {
  const { theme } = useTheme()
  const c = theme.colors
  const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`
  return `linear-gradient(135deg, ${tint(c.feedback.background.positive.intense, 16)}, ${tint(c.interactive.background.primary.default, 18)}), ${c.surface.background.gray.intense}`
}
