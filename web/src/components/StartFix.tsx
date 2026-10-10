import type { RefObject } from 'react'
import { ArrowDownIcon, Box, Button } from '@razorpay/blade/components'
import { prefersReducedMotion } from '../razorsense'

// The one call to action at the bottom of an incident's Timeline (DESIGN.md section 15, detail page): it takes the founder down to the fix steps,
// which sit below the evidence on a long page. The Timeline stays in view on wide screens, so the way to the fix does too. Below l the Timeline
// drops under the fix steps, where a button pointing down would scroll up, so there it sits under the stat row instead (`top`).
export function StartFix({ to, closed, top = false }: { to: RefObject<HTMLDivElement>; closed: boolean; top?: boolean }) {
  return (
    <Box marginTop={top ? undefined : 'spacing.5'} display={top ? { base: 'block', l: 'none' } : { base: 'none', l: 'block' }}>
      <Button variant="primary" size="medium" isFullWidth icon={ArrowDownIcon} iconPosition="right"
        onClick={() => to.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })}>
        {closed ? 'See how it was fixed' : 'Start the fix'}
      </Button>
    </Box>
  )
}
