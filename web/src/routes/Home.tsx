import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRightIcon, Badge, Box, Button, Card, CardBody, ChatInput, ChevronRightIcon, Divider, Heading, PlusIcon, RayIcon, Text } from '@razorpay/blade/components'
import { WelcomeTour } from '../components/WelcomeTour'
import { rupees, useGet, type Schemas } from '../lib/api'
import { IncidentsAnswer, ScanAnswer } from '../components/RayAnswers'
import { GUIDES } from '../lib/guides'
import { markWelcomed, setupDone, SETUP_STEPS, welcomeDue } from '../lib/setup'
import Ray from './Ray'

// Ray's chat here is not a model. A question about customers who paid and have no access gets the scan answer, a question about a pipe or a screen goes to that screen, anything else gets the incidents answer. Every figure in an answer is read from the data.
const SCAN = /scan|stuck|no access|paid/i
const JUMP: [RegExp, string][] = [
  [/channel|whatsapp|email|instagram/i, '/channels'],
  [/customer|complain|chat|conversation|thread/i, '/threads'],
  [/audit|log|history/i, '/audit'],
]
// Questions a merchant would ask, not page names: the side menu already lists the pages.
const EXPLORE = ['incidents', 'conversations', 'access', 'integration', 'channels', 'autonomy', 'learning', 'how', 'scan']
const QUESTIONS = ['Who paid and did not get access?', 'What is broken right now?', 'Which customers wrote in?']

// The Blindspot overview: what it is and what is wrong right now, Ray's input (like Razorpay's Ray home), setup progress, the pages, then what Ray sends on WhatsApp.
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
  const [welcome, setWelcome] = useState(welcomeDue)
  useEffect(markWelcomed, [])
  const { data: incs } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  const input = (
    <ChatInput value={value} onChange={({ value }) => setValue(value)} onSubmit={ask} placeholder="Ask Ray anything about your payments" accessibilityLabel="Ask Ray" hideFileUpload
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

  const open = (incs ?? []).filter((i) => i.status !== 'closed')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.9">
      <WelcomeTour open={welcome} onClose={() => setWelcome(false)} />
      {/* What Blindspot is comes first, in one heading and one line, then what is wrong right now, then Ray. A first-time merchant should know the product from this block alone. */}
      <Box borderRadius="large" padding={{ base: 'spacing.6', m: 'spacing.10' }} display="flex" flexDirection="column" alignItems="center" gap="spacing.6" testID="ray-home" backgroundColor="surface.background.primary.subtle">
        <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.3" maxWidth="720px">
          <Text color="surface.text.gray.subtle">Hello, Kaksha</Text>
          <Box textAlign="center"><Heading as="h1" size="2xlarge">Catch payment problems before your customers do</Heading></Box>
          <Box textAlign="center"><Text size="large" color="surface.text.gray.subtle">Razorpay sees the payment. Blindspot also watches your pay page before it and your app after it, finds every customer it affected, and fixes it once you approve.</Text></Box>
        </Box>
        {open.length > 0 && (
          <Box width="100%" maxWidth="720px" backgroundColor="surface.background.gray.intense" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.subtle" padding="spacing.5"
            display="flex" flexDirection={{ base: 'column', m: 'row' }} alignItems={{ base: 'flex-start', m: 'center' }} justifyContent="space-between" gap="spacing.4" testID="home-status">
            <Box display="flex" flexDirection="column" gap="spacing.1">
              <Text size="small" weight="semibold" color="feedback.text.notice.intense">Right now</Text>
              <Text weight="semibold">{`${open.length} payment issues · ${open.reduce((a, i) => a + i.affected, 0)} customers · ${rupees(open.reduce((a, i) => a + i.at_risk_paise, 0))} involved`}</Text>
            </Box>
            <Button variant="secondary" size="medium" iconPosition="right" icon={ArrowRightIcon} onClick={() => nav('/incidents')}>See them</Button>
          </Box>
        )}
        <Box width="100%" maxWidth="720px" display="flex" flexDirection="column" gap="spacing.3">
          <Box display="flex" alignItems="center" gap="spacing.2"><RayIcon size="medium" color="surface.icon.onSea.onSubtle" /><Text weight="semibold">Ask Ray</Text></Box>
          {input}
        </Box>
        <Box display="flex" flexWrap="wrap" justifyContent="center" gap="spacing.3">
          {QUESTIONS.map((q) => <Button key={q} variant="secondary" size="small" onClick={() => ask({ value: q })}>{q}</Button>)}
        </Box>
      </Box>

      <Card>
        <CardBody>
          <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', m: 'center' }} gap="spacing.5">
            <Box display="flex" flexDirection="column" gap="spacing.3">
              <Heading as="h2" size="medium">Set up Blindspot in {SETUP_STEPS} easy steps</Heading>
              <Text color="surface.text.gray.muted">Choose where customers can reach you, decide how much it does on its own, and see what is already broken.</Text>
              <Badge size="medium" color={done === SETUP_STEPS ? 'positive' : 'neutral'}>{`${done}/${SETUP_STEPS} COMPLETED`}</Badge>
            </Box>
            <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
              <Button variant="tertiary" size="large" onClick={() => setWelcome(true)}>Take the tour</Button>
              <Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => nav('/setup')}>{done === 0 ? 'Start setup' : done === SETUP_STEPS ? 'Review setup' : 'Continue setup'}</Button>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <Box display="flex" flexDirection="column" gap="spacing.5">
        <Heading as="h2" size="large">Explore Blindspot</Heading>
        {/* Nine cards in the side menu's order, each opening its page (its guide is one click away there, under "How it works").
            Three across from l, so the nine fill three rows; two across at m, where the first takes a whole row so none is left alone. */}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
          {EXPLORE.map((id) => GUIDES.find((g) => g.id === id)!).map((g, i) => (
            <Box key={g.id} gridColumn={i === 0 ? { base: 'auto', m: '1 / -1', l: 'auto' } : 'auto'}>
              <Link to={g.to} style={{ textDecoration: 'none' }}>
                <Card height="100%">
                  <CardBody>
                    <Box display="flex" flexDirection="column" gap="spacing.3" height="100%">
                      <Box display="flex" alignItems="center" gap="spacing.3"><g.icon size="medium" color="surface.icon.gray.muted" /><Text color="surface.text.gray.muted">{g.title}</Text></Box>
                      <Heading as="h3" size="small">{g.tagline}</Heading>
                      {/* The page in one line. Not on phones, where seven cards are already a long scroll. */}
                      <Box display={{ base: 'none', m: 'block' }}><Text size="small" color="surface.text.gray.muted" truncateAfterLines={3}>{g.summary ?? `${g.description.split('. ')[0].replace(/\.$/, '')}.`}</Text></Box>
                      <Box display="flex" flexDirection="column" gap="spacing.3" marginTop="auto" paddingTop="spacing.2">
                        <Divider />
                        <Box display="flex" justifyContent="space-between" alignItems="center"><Text size="small" weight="semibold" color="interactive.text.primary.normal">{`Open ${g.title}`}</Text><ChevronRightIcon size="medium" color="interactive.icon.primary.normal" /></Box>
                      </Box>
                    </Box>
                  </CardBody>
                </Card>
              </Link>
            </Box>
          ))}
        </Box>
      </Box>

      <Ray />
    </Box>
  )
}
