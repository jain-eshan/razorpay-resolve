import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { m } from 'framer-motion'
import { ActivityIcon, ArrowDownIcon, ArrowRightIcon, BellIcon, Box, Button, Card, CardBody, CheckIcon, ChevronRightIcon, ClockIcon, FileTextIcon, Heading, MessageSquareIcon, SlackIcon, Text, UserCheckIcon, WhatsAppIcon, type IconComponent } from '@razorpay/blade/components'
import { Accent } from '../components/Accent'
import { AccountLogo } from '../components/AccountLogo'
import { Crumbs } from '../components/Crumbs'
import { GuideArt } from '../components/GuideArt'
import { RulesFail } from '../components/RulesFail'
import { rulesData } from '../lib/rulesData'
import { useHeroWash } from '../components/iso'
import { ACCOUNTS, signIn, type AccountId } from '../lib/account'
import { useGet, type Schemas } from '../lib/api'
import { HERO, type ArtId } from '../lib/art'
import { useWidth } from '../lib/useWidth'
import { prefersReducedMotion } from '../razorsense'

// "How Resolve works" (v3 batch 1.5, T3): Resolve's landing page inside the dashboard, the one page that explains the whole product (docs/PRD_V3.md sections 1 to 4
// and 11). In order: the pitch with a way into each demo account; the two journeys as each merchant lives them; the engine (ways in, five steps, where the answer lands);
// why it needs an AI agent, with the evidence from the eval report; and what is built today against the production design. The only figures on it are in "Why an AI
// agent", read from the report; nothing is typed. The same page for both accounts.

// The five steps of an issue, named as the story strip on every payment issue page names them (components/StoryStrip.tsx).
const STEP_NAMES = ['Hear', 'Find everyone', 'Whose side', 'Fix', 'Win back']

// Each account's journey (PRD section 6, J1 and J2), as the merchant experiences it. `art` is the picture its card opens with, the same one as on the account picker.
const JOURNEYS: { id: AccountId; art: ArtId; who: string; steps: string[]; note: string }[] = [
  {
    id: 'kaksha', art: 'chat',
    who: 'Kaksha sells test series. A release breaks its webhook, so students pay and get no access.',
    steps: [
      'A student writes on WhatsApp: paid, no access. Resolve finds the payment.',
      'It finds every student the break hit, including those who never wrote in.',
      'It shows the proof: Kaksha’s own release broke the webhook.',
      'Kaksha approves access for a test run, then a small batch, then everyone.',
      'Kaksha approves one message, and every student hears their access is live.',
    ],
    note: 'Every number comes from the prototype’s own made-up payment data. Every channel is simulated.',
  },
  {
    id: 'flipkart', art: 'alert',
    who: 'Flipkart ships an app release that says “Payment failed” after a UPI payment went through.',
    steps: [
      'Flipkart’s alert tool, such as Sentry, tells Razorpay when errors climb.',
      'Resolve matches it to payments: everyone told “failed” after paying.',
      'The failures share one app version, so the cause is Flipkart’s release.',
      'Refunds for anyone who paid twice wait for Flipkart’s approval in Slack.',
      'Once their orders are confirmed, customers who paid are told so.',
    ],
    note: 'A demo account with its own made-up data. Taking alerts straight from Sentry, Datadog or PagerDuty is the next build.',
  },
]

// The engine (PRD section 4): the ways in, the five steps every problem goes through, and where the answer lands. The section's own sentence counts these lists.
type Item = { icon: IconComponent; title: string; text: string }
const INPUTS: Item[] = [
  { icon: MessageSquareIcon, title: 'Customer door', text: 'Complaints on WhatsApp, email, Instagram and the help button.' },
  { icon: ActivityIcon, title: 'Payment signals', text: 'Razorpay’s own records: webhooks, unpaid orders, duplicates.' },
  { icon: BellIcon, title: 'Alert door', text: 'A big brand’s alert tool: Sentry, Datadog, PagerDuty.' },
]
const DOORS = INPUTS.filter((i) => i.title.endsWith('door')).length
// Steps 2 to 5, named as the story strip names them (step 1, Hear, is the ways in above them). The rupee figure is part of finding everyone.
const ENGINE: { art: ArtId; text: string }[] = [
  { art: 'crowd', text: 'Every customer it hit, not only those who wrote in, and the money stuck.' },
  { art: 'proof', text: 'Your code, your settings, Razorpay or the bank, with proof.' },
  { art: 'approve', text: 'In small batches, and only after you approve.' },
  { art: 'winback', text: 'Customers told, then a check that the fix held.' },
]
const OUTPUTS: Item[] = [
  { icon: WhatsAppIcon, title: 'Ray on WhatsApp', text: 'A small business sees what broke and approves the fix.' },
  { icon: SlackIcon, title: 'Your Slack channel', text: 'A big brand gets the root cause where it already talks to Razorpay.' },
  { icon: UserCheckIcon, title: 'Customers won back', text: 'Access restored, refunds paid, customers told.' },
  { icon: FileTextIcon, title: 'Evidence pack', text: 'Sent to Razorpay support when the cause is on Razorpay’s side.' },
]

const TODAY = [
  'Rules and SQL produce every number. No AI model runs.',
  'Messages to customers are filled in from templates.',
  'Both accounts run on made-up data, with known answers to check against.',
  'The hosted demo replays recorded answers.',
]
const PRODUCTION = [
  'The same rules run inside Razorpay, as an agent in Agent Studio.',
  'An AI model reads complaints and alerts, picks what to check on a new kind of failure, and writes the root cause.',
  'It never produces a number and never moves money. When it is unsure, it hands over to a person.',
]

const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six']
const words = (n: number) => WORD[n] ?? String(n)
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

// Layouts are chosen from an element's own measured width, not the screen's (web/DESIGN.md section 23 A8). Measured: the page column is about 1072px at 1440, 912 at 1280,
// 656 at 1024 and 432 at 768; the engine card's inside is about 48px less. The hero puts its picture beside the words from 840px; the journeys sit side by side from 880px
// (two cards of about 430px, enough for a step's name and a line); the engine's ways in go three across from 600px (about 190px each, room for a two-line note beside the
// icon); its four steps go four across from 720px (about 165px each), two by two from 520px, and below that one row a step, the picture on the left; the four landing places
// go four across from 900px and two across from 520px.
const HERO_SIDE = 840, PAIR = 880, THREE = 600, ACROSS = 720, FOUR = 900, TWO = 520

// A light entrance for the top of the page: fade and a 16px rise, 360ms, entrance easing, 80ms apart (DESIGN.md section 8). Still for anyone who asks for less motion.
function Rise({ children, order = 0 }: { children: ReactNode; order?: number }) {
  if (prefersReducedMotion) return <>{children}</>
  return <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, ease: [0, 0, 0.2, 1], delay: order * 0.08 }}>{children}</m.div>
}

function Section({ id, title, line, children }: { id: string; title: string; line: string; children: ReactNode }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID={id} id={id}>
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading as="h2" size="large">{title}</Heading>
        <Text color="surface.text.gray.muted">{line}</Text>
      </Box>
      {children}
    </Box>
  )
}

function Hero() {
  const nav = useNavigate()
  const wash = useHeroWash()
  const [ref, room] = useWidth<HTMLDivElement>()
  const side = room >= HERO_SIDE
  const open = (id: AccountId) => { signIn(id); nav('/') }
  return (
    <Card testID="hero">
      <CardBody>
        <Box ref={ref} display="grid" gridTemplateColumns={side ? 'minmax(0, 5fr) minmax(0, 6fr)' : 'minmax(0, 1fr)'} gap={side ? 'spacing.8' : 'spacing.6'} alignItems="center">
          {/* The picture on the product's wash, inset in the card, as on a guide's hero slide (DESIGN.md section 16). */}
          <Box position="relative" height={side ? '320px' : '220px'} borderRadius="medium" overflow="hidden">
            <div style={{ position: 'absolute', inset: 0, background: wash }} />
            <img src={HERO.blindspot.src} alt={HERO.blindspot.alt} style={{ position: 'relative', display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
          </Box>
          <Box display="flex" flexDirection="column" alignItems="flex-start" gap="spacing.5">
            <Box display="flex" alignItems="center" gap="spacing.3">
              <Box width="24px" height="2px" backgroundColor="feedback.background.positive.intense" />
              <Text weight="semibold">How Resolve works</Text>
            </Box>
            <Heading as="h1" size="2xlarge">Find everyone a broken payment hit, and <Accent>win them back</Accent></Heading>
            <Text size="large" color="surface.text.gray.subtle">Resolve is Razorpay’s support engineer for every merchant. It hears about a payment problem from your customers or your own alerts, shows whose side it is with proof, and fixes it with your approval.</Text>
            <Box display="flex" flexWrap="wrap" gap="spacing.4">
              <Button variant="primary" size="large" icon={ArrowRightIcon} iconPosition="right" onClick={() => open('kaksha')}>{`See it as ${ACCOUNTS.kaksha.name}`}</Button>
              <Button variant="secondary" size="large" onClick={() => open('flipkart')}>{`See it as ${ACCOUNTS.flipkart.name}`}</Button>
            </Box>
            <Text size="small" color="surface.text.gray.muted">{`Two demo accounts: ${ACCOUNTS.kaksha.name}, a test-series business run by two founders, and ${ACCOUNTS.flipkart.name}, a large online marketplace. Every customer and payment in them is made up.`}</Text>
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}

// One journey: the account, the picture, the five steps as a numbered line down the card, the one honest note, and the way into that account.
function Journey({ j }: { j: (typeof JOURNEYS)[number] }) {
  const nav = useNavigate()
  const a = ACCOUNTS[j.id]
  return (
    <Card height="100%" testID={`journey-${j.id}`}>
      <CardBody height="100%">
        <Box display="flex" flexDirection="column" gap="spacing.5" height="100%">
          <GuideArt art={j.art} height="160px" />
          <Box display="flex" alignItems="center" gap="spacing.3">
            <AccountLogo account={a} size={48} />
            <Box display="flex" flexDirection="column">
              <Heading as="h3" size="medium">{a.name}</Heading>
              <Text size="small" color="surface.text.gray.muted">{a.line}</Text>
            </Box>
          </Box>
          <Text color="surface.text.gray.subtle">{j.who}</Text>
          <Box display="flex" flexDirection="column">
            {j.steps.map((text, i) => (
              <Box key={STEP_NAMES[i]} display="flex" gap="spacing.4" testID={`${j.id}-step-${i + 1}`}>
                {/* The number, and a thin line down to the next one, so the five read as one path. */}
                <Box display="flex" flexDirection="column" alignItems="center" flexShrink={0}>
                  <Box width="spacing.7" height="spacing.7" borderRadius="max" display="flex" alignItems="center" justifyContent="center" backgroundColor="surface.background.gray.moderate" borderWidth="thin" borderColor="surface.border.gray.normal">
                    <Text size="small" color="surface.text.gray.subtle">{i + 1}</Text>
                  </Box>
                  {i < j.steps.length - 1 && <Box flexGrow={1} borderLeftWidth="thin" borderLeftColor="surface.border.gray.normal" />}
                </Box>
                <Box display="flex" flexDirection="column" gap="spacing.1" paddingBottom={i < j.steps.length - 1 ? 'spacing.5' : 'spacing.0'} paddingTop="spacing.1" minWidth="spacing.0">
                  <Text weight="semibold">{STEP_NAMES[i]}</Text>
                  <Text size="small" color="surface.text.gray.muted">{text}</Text>
                </Box>
              </Box>
            ))}
          </Box>
          <Box display="flex" flexDirection="column" alignItems="flex-start" gap="spacing.4" marginTop="auto">
            <Text size="small" color="surface.text.gray.muted">{j.note}</Text>
            <Button variant="secondary" size="medium" icon={ChevronRightIcon} iconPosition="right" onClick={() => { signIn(j.id); nav('/') }}>{`Open ${a.name}’s dashboard`}</Button>
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}

function Journeys() {
  const [ref, room] = useWidth<HTMLDivElement>()
  return (
    <Box ref={ref} display="grid" gridTemplateColumns={room >= PAIR ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'} gap="spacing.6" alignItems="stretch">
      {JOURNEYS.map((j) => <Journey key={j.id} j={j} />)}
    </Box>
  )
}

// An icon on the pictures' wash, so the engine's ways in and landing places belong with the pictures above and below them.
function Mark({ icon: Icon }: { icon: IconComponent }) {
  const wash = useHeroWash()
  return (
    <Box position="relative" width="spacing.9" height="spacing.9" flexShrink={0} borderRadius="max" overflow="hidden" display="flex" alignItems="center" justifyContent="center">
      <div style={{ position: 'absolute', inset: 0, background: wash }} />
      <Box position="relative" display="flex"><Icon size="large" color="surface.icon.gray.normal" /></Box>
    </Box>
  )
}

function Items({ list, prefix, cols }: { list: Item[]; prefix: string; cols: number }) {
  return (
    <Box display="grid" gridTemplateColumns={cols > 1 ? `repeat(${cols}, minmax(0, 1fr))` : 'minmax(0, 1fr)'} gap="spacing.6">
      {list.map((n, i) => (
        <Box key={n.title} display="flex" alignItems="flex-start" gap="spacing.4" testID={`${prefix}-${i + 1}`}>
          <Mark icon={n.icon} />
          <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
            <Text weight="semibold">{n.title}</Text>
            <Text size="small" color="surface.text.gray.muted">{n.text}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// A label for one part of the engine, and an arrow on a hairline into the next part.
const Label = ({ children }: { children: string }) => <Text size="small" weight="semibold" color="surface.text.gray.muted">{children}</Text>
const Down = () => (
  <Box display="flex" alignItems="center" gap="spacing.4">
    <Box flexGrow={1} borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" />
    <ArrowDownIcon size="medium" color="surface.icon.gray.muted" />
    <Box flexGrow={1} borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" />
  </Box>
)

function Engine() {
  const [ref, room] = useWidth<HTMLDivElement>()
  const across = room >= ACROSS
  const pair = !across && room >= TWO
  const pic = 104  // a step's picture beside its words on a phone (2:1, so 52px high)
  return (
    <Card testID="engine">
      <CardBody>
        <Box ref={ref} display="flex" flexDirection="column" gap="spacing.6">
          <Box display="flex" flexDirection="column" gap="spacing.4">
            <Label>{`1. ${STEP_NAMES[0]}: a problem comes in`}</Label>
            <Items list={INPUTS} prefix="engine-in" cols={room >= THREE ? INPUTS.length : 1} />
          </Box>
          <Down />
          <Box display="flex" flexDirection="column" gap="spacing.4">
            <Label>{`2 to ${STEP_NAMES.length}: the same for every problem, whichever way it came in`}</Label>
            <Box display="grid" gridTemplateColumns={across ? `repeat(${ENGINE.length}, minmax(0, 1fr))` : pair ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'} gap="spacing.5">
              {ENGINE.map((s, i) => (
                <Box key={s.art} display={across || pair ? 'flex' : 'grid'} flexDirection="column" gridTemplateColumns={across || pair ? undefined : `${pic}px minmax(0, 1fr)`} alignItems={across || pair ? 'stretch' : 'center'} gap="spacing.4" testID={`engine-step-${i + 2}`}>
                  <GuideArt art={s.art} height={across || pair ? '96px' : `${pic / 2}px`} />
                  <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
                    <Text weight="semibold">{`${i + 2}. ${STEP_NAMES[i + 1]}`}</Text>
                    <Text size="small" color="surface.text.gray.muted">{s.text}</Text>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
          <Down />
          <Box display="flex" flexDirection="column" gap="spacing.4">
            <Label>Where the answer lands</Label>
            <Items list={OUTPUTS} prefix="engine-out" cols={room >= FOUR ? 4 : room >= TWO ? 2 : 1} />
          </Box>
          <Text size="small" color="surface.text.gray.muted">Every channel is simulated in this prototype. No real message is sent.</Text>
        </Box>
      </CardBody>
    </Card>
  )
}

// "Why an AI agent", with its evidence read from the eval report. While it loads, the card draws its own frame at its loaded size; an error says what failed; a report
// with no messy-complaints run leaves the whole section out rather than a heading with nothing under it.
function WhyAgent() {
  const { data, error } = useGet<Schemas['EvalReport']>('/api/eval/report')
  const rules = data && rulesData(data.metrics)
  if (data && !rules) return null
  return (
    <Section id="why-ai" title="Why an AI agent" line="Customers write in Hinglish, with typos, two problems at once. Rules misread them, so an AI agent reads each message first, and the rules still produce every number.">
      {error ? <Text color="feedback.text.negative.intense">{`Could not load the test results: ${error}`}</Text> : <RulesFail data={rules ?? undefined} />}
    </Section>
  )
}

// Built lines carry a tick; the production design carries a clock, so nothing not built reads as done.
function Side({ title, tag, lines, id, icon: Icon }: { title: string; tag: string; lines: string[]; id: string; icon: IconComponent }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4" testID={id}>
      <Box display="flex" flexDirection="column" gap="spacing.1">
        <Heading as="h3" size="small">{title}</Heading>
        <Text size="small" color="surface.text.gray.muted">{tag}</Text>
      </Box>
      {lines.map((l) => (
        <Box key={l} display="flex" alignItems="flex-start" gap="spacing.3">
          <Box flexShrink={0} paddingTop="spacing.1" display="flex"><Icon size="small" color="surface.icon.gray.muted" /></Box>
          <Text color="surface.text.gray.subtle">{l}</Text>
        </Box>
      ))}
    </Box>
  )
}

function TodayAndProduction() {
  const [ref, room] = useWidth<HTMLDivElement>()
  return (
    <Card testID="today-production">
      <CardBody>
        <Box ref={ref} display="grid" gap="spacing.7" gridTemplateColumns={room >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'}>
          <Side id="today" title="In this prototype" tag="What you can try now" lines={TODAY} icon={CheckIcon} />
          <Side id="production" title="In production" tag="The design, not built yet" lines={PRODUCTION} icon={ClockIcon} />
        </Box>
      </CardBody>
    </Card>
  )
}

export default function HowItWorks() {
  const nav = useNavigate()
  const { hash } = useLocation()
  // A link to one section (Accuracy links to "Why an AI agent") lands on it. The sections above it have no data, so its place is known on the first paint.
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }) }, [hash])
  return (
    <Box display="flex" flexDirection="column" gap="spacing.9">
      <Box display="flex" flexDirection="column" gap="spacing.4">
        <Crumbs items={[{ label: 'Overview', to: '/' }, { label: 'How Resolve works', to: '/how-it-works' }]} />
        <Rise><Hero /></Rise>
      </Box>

      <Rise order={1}>
        <Section id="journeys" title={`${cap(words(JOURNEYS.length))} merchant journeys, one recovery workflow`} line={`A problem reaches each one differently. After that, the same ${words(STEP_NAMES.length)} steps.`}>
          <Journeys />
        </Section>
      </Rise>

      <Section id="inside" title="Inside Resolve" line={`${cap(words(DOORS))} doors and Razorpay’s own payment records in, ${words(STEP_NAMES.length)} steps, ${words(OUTPUTS.length)} places the answer lands.`}>
        <Engine />
      </Section>

      <WhyAgent />

      <Section id="today-and-production" title="Today and in production" line="What this prototype does, and what changes inside Razorpay.">
        <TodayAndProduction />
      </Section>

      <Box><Button variant="tertiary" size="large" onClick={() => nav('/')}>Back to Overview</Button></Box>
    </Box>
  )
}
