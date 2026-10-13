import { Link as RouterLink } from 'react-router-dom'
import { Box, Card, CardBody, ChevronRightIcon, Heading, Skeleton, Text, UnlockIcon } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'

// Unpaid renewals on the Overview (Kaksha only): one number that opens the page. It is a full-width row under the four cards, not a fifth card, because it is a
// different kind of number: a balance the merchant is owed, not a payment issue. It never changes size with its data: the value and the line under it are always one
// line each (the line on the right shows from l, where there is room for it), and while loading the same text is laid out with a blank in it and a Skeleton over it.
export function UnpaidRenewalsRow() {
  const { data, error } = useGet<Schemas['LeakageReport']>('/api/leakage')
  const n = data?.rows.length ?? 0
  const blank = '\u00a0'  // a no-break space keeps each line its height while the data loads
  const value = data ? rupees(data.owed_paise) : error ? 'Not loaded' : blank
  const hint = data ? (n ? `owed from ${n} failed renewal${n === 1 ? '' : 's'}` : 'nobody is past your grace period') : error ? 'open the page to try again' : blank
  const loading = !data && !error
  return (
    <RouterLink to="/access" style={{ textDecoration: 'none' }} data-testid="home-unpaid">
      <Card>
        <CardBody>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing.4">
            <Box display="flex" alignItems="flex-start" gap="spacing.4" minWidth="spacing.0">
              <Box flexShrink={0} display="flex"><UnlockIcon size="large" color={n ? 'feedback.icon.notice.intense' : 'surface.icon.gray.muted'} /></Box>
              <Box display="flex" flexDirection="column" minWidth="spacing.0">
                <Text size="small" weight="semibold" color="surface.text.gray.subtle">Unpaid renewals</Text>
                <Box position="relative">
                  <Heading as="h2" size="large">{value}</Heading>
                  {loading && <Box position="absolute" top="spacing.0" bottom="spacing.0" left="spacing.0" width="120px" display="flex" alignItems="center"><Skeleton width="100%" height="70%" borderRadius="medium" /></Box>}
                </Box>
                <Text size="small" color="surface.text.gray.muted" truncateAfterLines={1}>{hint}</Text>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap="spacing.4">
              <Box display={{ base: 'none', l: 'block' }} maxWidth="360px">
                <Text size="small" color="surface.text.gray.muted" textAlign="right">Customers whose UPI renewal failed for lack of money and who still have access. Not a payment issue.</Text>
              </Box>
              <Box flexShrink={0} display="flex"><ChevronRightIcon size="medium" color="surface.icon.gray.muted" /></Box>
            </Box>
          </Box>
        </CardBody>
      </Card>
    </RouterLink>
  )
}
