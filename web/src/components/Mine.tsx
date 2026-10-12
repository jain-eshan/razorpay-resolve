import type { ReactNode } from 'react'
import { Button, EmptyState, UsersIcon } from '@razorpay/blade/components'
import { ACCOUNTS, signIn, useAccount, type AccountId } from '../lib/account'

// A page that belongs to one account's way of working: a shopping app does not take customer complaints through Blindspot, sell renewals or set up customer channels.
// Under the other account it says so and offers the switch, instead of showing the other merchant's data.
export function Mine({ only, children }: { only: AccountId; children: ReactNode }) {
  const me = useAccount()
  if (me.id === only) return <>{children}</>
  const them = ACCOUNTS[only]
  return (
    <EmptyState size="large" asset={<UsersIcon size="2xlarge" color="surface.icon.gray.muted" />} title={`This page is part of ${them.name}'s account`}
      description={`${me.name} works differently: ${me.kind === 'enterprise' ? 'its own alert tools tell Blindspot about problems, and answers go to its Slack channel' : 'customers tell Blindspot about problems, and answers go to Ray on WhatsApp'}. Switch to ${them.name} to see this page.`}>
      <Button variant="primary" onClick={() => signIn(only)}>{`Switch to ${them.name}`}</Button>
    </EmptyState>
  )
}
