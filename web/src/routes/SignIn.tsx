import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon, Avatar, Badge, Box, Button, Card, CardBody, CheckIcon, Heading, Text } from '@razorpay/blade/components'
import { GuideArt } from '../components/GuideArt'
import { ACCOUNTS, accountId, signIn, signedIn, type AccountId } from '../lib/account'
import type { ArtId } from '../lib/art'

// What each account shows, in three lines a judge can hold in their head before they pick. Words only: the figures are on the pages behind.
const SEE: Record<AccountId, { art: ArtId; lines: string[] }> = {
  kaksha: { art: 'chat', lines: ['Customers write on WhatsApp, Instagram and email', 'Ray tells the founder on WhatsApp', 'Each fix waits for the founder’s approval'] },
  flipkart: { art: 'alert', lines: ['Your own alert tools tell Blindspot', 'The root cause lands in your Slack channel', 'Refunds and messages wait for your approval'] },
}

// The way in (v3, two accounts): one Razorpay dashboard, two demo merchants. Not a login: there is no password field and nothing to type, so it cannot be taken for a real
// sign-in page. The page sits outside the dashboard shell, under the same black bar with Razorpay's logo.
export default function SignIn() {
  const nav = useNavigate()
  const [pick, setPick] = useState<AccountId>(signedIn() ? accountId() : 'kaksha')
  return (
    <Box minHeight="100vh" backgroundColor="surface.background.gray.moderate" display="flex" flexDirection="column">
      <Box backgroundColor="surface.background.cloud.intense" paddingX="spacing.6" paddingY="spacing.5" display="flex" alignItems="center" testID="signin-bar">
        <img src="/razorpay-logo.svg" alt="Razorpay" width="112" height="24" style={{ display: 'block' }} />
      </Box>
      <main>
        <Box testID="page" maxWidth="960px" marginX="auto" padding={{ base: 'spacing.5', m: 'spacing.9' }} display="flex" flexDirection="column" gap="spacing.7">
          <Box display="flex" flexDirection="column" gap="spacing.3" alignItems={{ base: 'flex-start', m: 'center' }} textAlign={{ base: 'left', m: 'center' }}>
            <Badge color="positive" size="medium">Blindspot · Beta</Badge>
            <Heading as="h1" size="xlarge">Choose a demo account</Heading>
            <Text color="surface.text.gray.muted">The same dashboard, set up for a small business or for a big brand. You can switch from your avatar at any time.</Text>
          </Box>
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))' }} gap="spacing.6">
            {(Object.keys(ACCOUNTS) as AccountId[]).map((id) => {
              const a = ACCOUNTS[id]
              const on = pick === id
              return (
                <Card key={id} isSelected={on} onClick={() => setPick(id)} accessibilityLabel={`${a.name}, ${a.line}`} height="100%" testID={`account-${id}`}>
                  <CardBody height="100%">
                    <Box display="flex" flexDirection="column" gap="spacing.5" height="100%">
                      <GuideArt art={SEE[id].art} height="160px" />
                      <Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing.4">
                        <Box display="flex" alignItems="center" gap="spacing.3">
                          <Avatar name={a.name} size="medium" />
                          <Box display="flex" flexDirection="column">
                            <Heading as="h2" size="medium">{a.name}</Heading>
                            <Text size="small" color="surface.text.gray.muted">{a.line}</Text>
                          </Box>
                        </Box>
                        {on && <Badge color="primary" size="medium" icon={CheckIcon}>Selected</Badge>}
                      </Box>
                      <Text color="surface.text.gray.subtle">{a.detail}</Text>
                      <Box display="flex" flexDirection="column" gap="spacing.3" marginTop="auto">
                        {SEE[id].lines.map((l) => (
                          <Box key={l} display="flex" alignItems="flex-start" gap="spacing.3">
                            <Box flexShrink={0} paddingTop="spacing.1" display="flex"><CheckIcon size="small" color="feedback.icon.positive.intense" /></Box>
                            <Text size="small">{l}</Text>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </CardBody>
                </Card>
              )
            })}
          </Box>
          <Box display="flex" flexDirection="column" alignItems={{ base: 'stretch', m: 'center' }} gap="spacing.3">
            <Button variant="primary" size="large" icon={ArrowRightIcon} iconPosition="right" onClick={() => { signIn(pick); nav('/') }}>{`Continue as ${ACCOUNTS[pick].name}`}</Button>
            <Text size="small" color="surface.text.gray.muted" textAlign="center">Demo accounts. No password, and every customer and payment in them is made up.</Text>
          </Box>
        </Box>
      </main>
    </Box>
  )
}
