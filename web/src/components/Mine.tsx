import type { ReactNode } from 'react'
import { Box, Button, EmptyState } from '@razorpay/blade/components'
import { GuideArt } from './GuideArt'
import { ACCOUNTS, signIn, useAccount, type AccountId } from '../lib/account'

// A page that belongs to one account's way of working: a shopping app does not take customer complaints through Resolve, sell renewals or set up customer channels.
// Under the other account it says so and offers the switch, instead of showing the other merchant's data.
export function Mine({ only, children }: { only: AccountId; children: ReactNode }) {
  const me = useAccount()
  if (me.id === only) return <>{children}</>
  const them = ACCOUNTS[only]
  return (
    // A picture and a reading measure, as every empty state here (DESIGN.md section 15).
    <Box maxWidth="720px" marginX="auto" paddingY="spacing.9">
    <EmptyState size="large" asset={<Box width="120px"><GuideArt art="proof" height="80px" /></Box>} title={`This page is part of ${them.name}'s account`}
      description={`${me.name} works differently: ${me.kind === 'enterprise' ? 'its own alert tools tell Resolve about problems, and answers go to its Slack channel' : 'customers tell Resolve about problems, and answers go to Ray on WhatsApp'}. Switch to ${them.name} to see this page.`}>
      <Button variant="primary" onClick={() => signIn(only)}>{`Switch to ${them.name}`}</Button>
    </EmptyState>
    </Box>
  )
}
