import { Box } from '@razorpay/blade/components'
import { AlertTriangleIcon, BellOffIcon, RupeesIcon } from '@razorpay/blade/components'
import { rupees, type Schemas } from '../lib/api'
import { AMOUNT_NOTE } from '../lib/format'
import { Stat } from './Stat'

// The three numbers every payment issue opens with (roadmap I2): customers hit, money stuck, customers who never wrote in. The same three on every kind of issue, so a merchant reads
// any of them the same way; what is specific to the issue is in the story strip, the evidence and the actions.
export function IncidentStats({ inc }: { inc: Pick<Schemas['IncidentDetail'], 'affected' | 'silent' | 'at_risk_paise' | 'mismatch_type' | 'tier_counts' | 'status'> }) {
  const share = inc.affected > 0 ? `${Math.round((inc.silent / inc.affected) * 100)}% of the customers hit` : 'no customers hit yet'
  return (
    <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5" testID="incident-stats">
      <Stat label="Customers hit" value={String(inc.affected)} hint={inc.status === 'closed' ? 'all put right' : `${inc.tier_counts.exact ?? 0} still to put right`} icon={AlertTriangleIcon} tone="notice" />
      <Stat label="Money stuck" value={rupees(inc.at_risk_paise)} hint={AMOUNT_NOTE[inc.mismatch_type] ?? 'still to recover'} icon={RupeesIcon} />
      <Stat label="Never wrote in" value={String(inc.silent)} hint={share} icon={BellOffIcon} />
    </Box>
  )
}
