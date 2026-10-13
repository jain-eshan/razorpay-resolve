import { Box } from '@razorpay/blade/components'
import type { Account } from '../lib/account'

// An account's logo as a square, beside its name. The name is always written next to it, so the picture is decorative (empty alt). A plain `<img>`: Blade has no image
// component (web/CLAUDE.md). Both files are square and the wrapper rounds them the same, so the size is the only number.
export function AccountLogo({ account, size = 40 }: { account: Account; size?: number }) {
  return (
    <Box flexShrink={0} display="flex" borderRadius="large" overflow="hidden" testID={`logo-${account.id}`}>
      <img src={account.logo} alt="" width={size} height={size} style={{ display: 'block' }} />
    </Box>
  )
}
