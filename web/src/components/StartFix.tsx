import type { RefObject } from 'react'
import { ArrowDownIcon, Box, Button } from '@razorpay/blade/components'
import { prefersReducedMotion } from '../razorsense'

// The call to action that takes the founder down to the fix steps, which sit below the evidence on a long page. It is the page's one blue button, in the Actions card.
// The Timeline stays in view on wide screens, so a second, quieter copy sits under it there (`variant="secondary"` `wideOnly`) and the way to the fix stays in reach.
export function StartFix({ to, closed, variant = 'primary', wideOnly = false }: { to: RefObject<HTMLDivElement>; closed: boolean; variant?: 'primary' | 'secondary'; wideOnly?: boolean }) {
  return (
    <Box marginTop={wideOnly ? 'spacing.5' : undefined} display={wideOnly ? { base: 'none', l: 'block' } : 'block'}>
      <Button variant={variant} size="medium" isFullWidth icon={ArrowDownIcon} iconPosition="right"
        onClick={() => to.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })}>
        {closed ? 'See how it was fixed' : 'Start the fix'}
      </Button>
    </Box>
  )
}
