import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRightIcon, Badge, Box, Button, Card, CardBody, ChatInput, ChevronRightIcon, Heading, PlusIcon, RayIcon, Text } from '@razorpay/blade/components'
import { IsoHero } from '../components/IsoHero'
import { IncidentsAnswer, ScanAnswer } from '../components/RayAnswers'
import { GUIDES, guideById } from '../lib/guides'
import { useHeroWash } from '../components/iso'
import { setupDone, SETUP_STEPS } from '../lib/setup'
import Ray from './Ray'

// Ray's chat here is not a model. A question about customers who paid and have no access gets the scan answer, a question about a pipe or a screen goes to that screen, anything else gets the incidents answer. Every figure in an answer is read from the data.
const SCAN = /scan|stuck|no access|paid/i
const JUMP: [RegExp, string][] = [
  [/channel|whatsapp|email|instagram/i, '/channels'],
  [/customer|complain|chat|conversation|thread/i, '/threads'],
  [/audit|log|history/i, '/audit'],
]
const CHIPS = [['Incidents', '/incidents'], ['Conversations', '/threads'], ['Day-0 scan', '/scan'], ['Channels', '/channels']] as const

// The Blindspot home: Ray first (like Razorpay's Ray home), then setup progress, then what Blindspot does, then what Ray sends on WhatsApp.
export default function Home() {
  const nav = useNavigate()
  const [value, setValue] = useState('')
  const [asked, setAsked] = useState<{ q: string; kind: 'scan' | 'incidents' }>()
  const ask = ({ value }: { value: string }) => {
    const q = value.trim()
    if (!q) return
    const to = JUMP.find(([re]) => re.test(q))?.[1]
    if (to) return nav(to)
    setAsked({ q, kind: SCAN.test(q) ? 'scan' : 'incidents' })
    setValue('')
  }
  const done = setupDone()
  const wash = useHeroWash()
  const input = (
    <ChatInput value={value} onChange={({ value }) => setValue(value)} onSubmit={ask} placeholder="Ask Ray anything about your payments" accessibilityLabel="Ask Ray"
      suggestions={['Who did the failed webhook affect?', 'Which customers paid and have no access?']} onSuggestionAccept={({ suggestion }) => setValue(suggestion)} />
  )

  if (asked) {
    return (
      <Box display="flex" flexDirection="column" gap="spacing.7" maxWidth="840px" marginX="auto" testID="ray-thread">
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap="spacing.4">
          <Button variant="tertiary" size="medium" icon={PlusIcon} onClick={() => setAsked(undefined)}>New chat</Button>
          <Box backgroundColor="surface.background.gray.intense" borderRadius="large" borderWidth="thin" borderColor="surface.border.gray.subtle" paddingX="spacing.6" paddingY="spacing.5"><Text>{asked.q}</Text></Box>
        </Box>
        {asked.kind === 'scan' ? <ScanAnswer /> : <IncidentsAnswer />}
        <Box position="sticky" bottom="spacing.0" backgroundColor="surface.background.gray.moderate" paddingY="spacing.5">{input}</Box>
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" gap="spacing.9">
      <Box borderRadius="large" padding={{ base: 'spacing.6', m: 'spacing.10' }} display="flex" flexDirection="column" alignItems="center" gap="spacing.6" testID="ray-home" backgroundColor="surface.background.primary.subtle">
        <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.3">
          <Text color="surface.text.gray.subtle">Hello, Kaksha</Text>
          <Box display="flex" flexDirection={{ base: 'column', l: 'row' }} alignItems="center" gap="spacing.4">
            <RayIcon size="2xlarge" color="surface.icon.onSea.onSubtle" />
            <Heading size="2xlarge">What can I do for you today?</Heading>
          </Box>
        </Box>
        <Box width="100%" maxWidth="720px">{input}</Box>
        <Box display="flex" flexWrap="wrap" justifyContent="center" gap="spacing.3">
          {CHIPS.map(([label, to]) => <Button key={to} variant="secondary" size="medium" onClick={() => nav(to)}>{label}</Button>)}
        </Box>
      </Box>

      {/* Razorpay's agent pages open a new product with a soft mint-to-blue hero and one button. It always shows, so a judge can take the tour again and again (this is a demo). */}
      <Box position="relative" overflow="hidden" borderRadius="large" testID="tour-card">
          <div style={{ position: 'absolute', inset: 0, background: wash }} />
          <Box position="relative" display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'minmax(0, 1fr) minmax(0, 1fr)' }} alignItems="center" gap="spacing.5" padding={{ base: 'spacing.6', m: 'spacing.8' }}>
            <Box display="flex" flexDirection="column" alignItems="flex-start" gap="spacing.4">
              <Badge size="medium" color="positive">NEW</Badge>
              <Heading size="xlarge">{guideById('blindspot')?.tagline}</Heading>
              <Text color="surface.text.gray.subtle">New to Blindspot? A short tour of what it is, why it helps and how to use it.</Text>
              <Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => nav('/guides/blindspot')}>Take the tour</Button>
            </Box>
            <Box display={{ base: 'none', l: 'block' }}><IsoHero /></Box>
          </Box>
        </Box>

      <Card>
        <CardBody>
          <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', m: 'center' }} gap="spacing.5">
            <Box display="flex" flexDirection="column" gap="spacing.3">
              <Heading size="medium">Set up Blindspot in {SETUP_STEPS} easy steps</Heading>
              <Text color="surface.text.gray.muted">Choose your channels, set how much it does on its own, and run your first scan.</Text>
              <Badge size="medium" color={done === SETUP_STEPS ? 'positive' : 'neutral'}>{`${done}/${SETUP_STEPS} COMPLETED`}</Badge>
            </Box>
            <Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => nav('/setup')}>{done === 0 ? 'Start setup' : done === SETUP_STEPS ? 'Review setup' : 'Continue setup'}</Button>
          </Box>
        </CardBody>
      </Card>

      <Box display="flex" flexDirection="column" gap="spacing.5">
        <Heading size="large">Explore Blindspot</Heading>
        <Box display="grid" gridTemplateColumns={{ base: '1fr', m: 'repeat(2, minmax(0, 1fr))', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
          {GUIDES.map((g) => (
            <Link key={g.id} to={`/guides/${g.id}`} style={{ textDecoration: 'none' }}>
              <Card height="100%">
                <CardBody>
                  <Box display="flex" flexDirection="column" gap="spacing.4" height="100%">
                    <Box display="flex" alignItems="center" gap="spacing.3"><g.icon size="medium" color="surface.icon.gray.muted" /><Text color="surface.text.gray.muted">{g.title}</Text></Box>
                    <Heading size="small">{g.tagline}</Heading>
                    <Box display="flex" justifyContent="flex-end" marginTop="auto"><ChevronRightIcon size="medium" color="surface.icon.gray.muted" /></Box>
                  </Box>
                </CardBody>
              </Card>
            </Link>
          ))}
        </Box>
      </Box>

      <Ray />
    </Box>
  )
}
