import { useLocation, useNavigate } from 'react-router-dom'
import { Box, StepGroup, StepItem, StepItemIndicator } from '@razorpay/blade/components'

// Integration is one item in the side menu with two steps, as Razorpay's own integration guides number them ("1. Build Integration, 2. Test Integration").
// Build with AI is /connect, the go-live check is /release-check. Each page shows both steps at the top, so the merchant always sees where they are.
const STEPS = [
  { to: '/connect', title: '1. Build with AI', description: 'Paste one prompt into your coding agent' },
  { to: '/release-check', title: '2. Go-live check', description: 'Test it before every release' },
]

export function IntegrationSteps() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  return (
    <Box>
      <StepGroup orientation="horizontal" size="medium" width="100%">
        {STEPS.map((s, i) => {
          const on = pathname.startsWith(s.to)
          return (
            <StepItem key={s.to} title={s.title} description={s.description} isSelected={on} stepProgress={i === 0 ? 'end' : 'start'}
              marker={<StepItemIndicator color={on ? 'primary' : 'neutral'} />} onClick={() => nav(s.to)} />
          )
        })}
      </StepGroup>
    </Box>
  )
}
