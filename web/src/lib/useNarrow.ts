import { useBreakpoint } from '@razorpay/blade/utils'
import { useTheme } from '@razorpay/blade/components'

// True on a phone. Charts use it to print fewer labels on the axis, because the plot is about 260px wide there.
export const useNarrow = () => {
  const { theme } = useTheme()
  return useBreakpoint({ breakpoints: theme.breakpoints }).matchedDeviceType === 'mobile'
}
