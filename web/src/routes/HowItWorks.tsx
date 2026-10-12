import { Fragment, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActivityIcon, ArrowDownIcon, ArrowRightIcon, BellIcon, Badge, Box, Button, ChevronRightIcon, FileTextIcon, Heading, MessageSquareIcon, Text, UserCheckIcon, UsersIcon, WhatsAppIcon, type IconComponent } from '@razorpay/blade/components'
import { Crumbs } from '../components/Crumbs'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { useWidth } from '../lib/useWidth'

// "How Blindspot works" (v3 batch 1.4, S1): the two journeys of docs/PRD_V3.md (section 6, J1 and J2) as two lanes of five steps, and the engine (PRD section 4: two ways in,
// five steps, where it lands) drawn from Blade boxes. Every sentence says what the product does today or says it is not built yet or the production design (PRD section 11,
// "Today versus production"). No figures: the numbers belong to the payment issue pages, where they are read from the data, so none is typed here.

// The five steps of an issue, named as the story strip on every payment issue page names them (components/StoryStrip.tsx).
const STEP_NAMES = ['Hear', 'Find everyone', 'Whose side', 'Fix', 'Win back']

// Parts that do not exist yet carry this tag, in the notice colour (web/DESIGN.md section 15, status colours). Everything built is grey.
const NOT_BUILT = 'Not built yet'

const LANES = [
  {
    id: 'customer', title: 'A small merchant', tag: 'Built',
    who: 'Kaksha sells test series. A release breaks its webhook, so students pay and get no access.',
    note: 'Runs on this prototype, with a made-up merchant. Every channel is simulated.',
    steps: [
      'A student messages Kaksha. Blindspot asks which payment, then finds it in Razorpay’s records.',
      'It finds every student the same break hit, including those who never wrote in.',
      'It shows the records behind the cause. Here the cause is Kaksha’s own code.',
      'Kaksha approves a test run, then a first small batch of students, then the rest.',
      'Kaksha approves one message, and the students are told their access is live.',
    ],
  },
  {
    id: 'alert', title: 'A big brand', tag: NOT_BUILT,
    who: 'A large shopping app ships a release that shows “Payment failed” after a UPI payment went through.',
    note: 'A walk-through only: the alert intake is not built in the engine yet.',
    steps: [
      'The brand’s alert tool (Sentry, Datadog, PagerDuty or a webhook) forwards the error to Razorpay.',
      'Blindspot matches the alert to Razorpay’s records and finds every customer who saw a failure after paying.',
      'It checks where the failures sit. Here they share one app version, so the cause is the brand’s app.',
      'Razorpay-side actions, such as refunding duplicate payments, wait for the brand’s approval in Slack.',
      'Customers who paid and have no order are told it went through, once the brand approves.',
    ],
  },
]

// Counts said in words are built from what is drawn, so a sentence about the page cannot drift from the boxes beside it (a test reads them back).
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six']
const words = (n: number) => WORD[n] ?? String(n)
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

// Layout is chosen from an element's own width, measured before the first paint, not from the screen's (web/DESIGN.md section 23 A8).
// A lane: five boxes across from 960px (about 180px a box, the page column at 1440px); from 560px one row a step, name on the left and words on the right, so a mid-size
// column is not a stack of mostly empty cards; narrower, numbered cards. The engine: three columns from 760px; narrower, the three parts stack, and from 520px the boxes
// inside a part sit side by side where a part has three or four of them.
const ACROSS = 960, ROW = 560, COLUMNS = 760, SIDE = 520

function Step({ n, title, text, id, row }: { n: number; title: string; text: string; id: string; row: boolean }) {
  return (
    <Box display="flex" alignItems={row ? 'center' : 'flex-start'} gap="spacing.3" padding="spacing.4" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.subtle" backgroundColor="surface.background.gray.subtle" testID={id}>
      <Box width="spacing.6" height="spacing.6" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center" backgroundColor="surface.background.gray.intense" borderWidth="thin" borderColor="surface.border.gray.normal">
        <Text size="xsmall" weight="semibold" color="surface.text.gray.muted">{n}</Text>
      </Box>
      {/* In a row the names share one column width (140px fits "Find everyone"), so the words line up under each other. */}
      <Box display="flex" flexDirection={row ? 'row' : 'column'} gap={row ? 'spacing.5' : 'spacing.1'} minWidth="spacing.0" flexGrow={1}>
        <Box width={row ? '140px' : undefined} flexShrink={0}><Text weight="semibold">{title}</Text></Box>
        <Text size="small" color="surface.text.gray.muted">{text}</Text>
      </Box>
    </Box>
  )
}

function Lane({ lane }: { lane: (typeof LANES)[number] }) {
  const [ref, room] = useWidth<HTMLDivElement>()
  const across = room >= ACROSS
  const row = !across && room >= ROW
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID={`lane-${lane.id}`}>
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Box display="flex" alignItems="center" gap="spacing.4" flexWrap="wrap"><Heading as="h3" size="small">{lane.title}</Heading><Badge size="medium" color={lane.tag === NOT_BUILT ? 'notice' : 'neutral'}>{lane.tag}</Badge></Box>
        <Text color="surface.text.gray.muted">{lane.who}</Text>
        <Text size="small" color="surface.text.gray.muted">{lane.note}</Text>
      </Box>
      {/* With arrows between the boxes across; without them, the numbers say the order. */}
      <Box ref={ref} display="grid" gap={across ? 'spacing.2' : row ? 'spacing.3' : 'spacing.4'} alignItems="stretch" gridTemplateColumns={across ? 'minmax(0, 1fr) 20px minmax(0, 1fr) 20px minmax(0, 1fr) 20px minmax(0, 1fr) 20px minmax(0, 1fr)' : 'minmax(0, 1fr)'}>
        {lane.steps.map((text, i) => (
          <Fragment key={STEP_NAMES[i]}>
            <Step n={i + 1} title={STEP_NAMES[i]} text={text} id={`${lane.id}-step-${i + 1}`} row={row} />
            {across && i < 4 && <Box display="flex" alignItems="center" justifyContent="center"><ChevronRightIcon size="medium" color="surface.icon.gray.muted" /></Box>}
          </Fragment>
        ))}
      </Box>
    </Box>
  )
}

// A box in the engine picture: where a problem comes in, or where the answer lands. `grow` lets the boxes in a column share its height, so the three columns line up.
function Node({ icon: Icon, title, text, tag, id }: { icon: IconComponent; title: string; text: string; tag?: string; id: string }) {
  return (
    <Box flexGrow="1" display="flex" alignItems="flex-start" gap="spacing.4" padding="spacing.4" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.subtle" backgroundColor="surface.background.gray.subtle" testID={id}>
      <Box flexShrink={0} display="flex"><Icon size="large" color="surface.icon.gray.muted" /></Box>
      <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
        <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap"><Text weight="semibold">{title}</Text>{tag && <Badge size="small" color={tag === NOT_BUILT ? 'notice' : 'neutral'}>{tag}</Badge>}</Box>
        <Text size="small" color="surface.text.gray.muted">{text}</Text>
      </Box>
    </Box>
  )
}

type NodeSpec = { icon: IconComponent; title: string; text: string; tag?: string; door?: boolean }
// The ways in: two doors, and the payment signals Razorpay already has. The places the answer lands: four. The page's own sentences count these lists.
const INPUTS: NodeSpec[] = [
  { icon: UsersIcon, title: 'Customer door', door: true, text: 'WhatsApp, email, Instagram, the help button and public posts.' },
  { icon: ActivityIcon, title: 'Payment signals', text: 'Webhooks, orders nobody tried to pay for, dips by payment method, duplicates.' },
  { icon: BellIcon, title: 'Alert door', door: true, tag: NOT_BUILT, text: 'Sentry, Datadog, PagerDuty or a plain webhook.' },
]
const ENGINE = ['Find everyone affected', 'Put a rupee figure on it', 'Say whose side it is, with proof', 'Fix, with your approval', 'Win customers back and check it held']
const OUTPUTS: NodeSpec[] = [
  { icon: WhatsAppIcon, title: 'Ray on WhatsApp', text: 'The founder sees what broke and approves the fix.' },
  { icon: MessageSquareIcon, title: 'A shared Slack channel', tag: NOT_BUILT, text: 'For big brands, the root cause, signed off by a Razorpay support engineer.' },
  { icon: UserCheckIcon, title: 'Customers won back', text: 'Access restored, refunds paid, renewal links sent.' },
  { icon: FileTextIcon, title: 'Evidence pack', text: 'Goes to Razorpay support when the cause is on Razorpay’s side.' },
]
const DOORS = INPUTS.filter((i) => i.door).length

function Column({ label, children, across }: { label: string; children: ReactNode; across?: number }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Text size="small" weight="semibold" color="surface.text.gray.muted">{label}</Text>
      <Box display={across ? 'grid' : 'flex'} flexDirection="column" gridTemplateColumns={across ? `repeat(${across}, minmax(0, 1fr))` : undefined} gap="spacing.4" flexGrow="1">{children}</Box>
    </Box>
  )
}

const nodes = (list: NodeSpec[], prefix: string) => list.map((n, i) => <Node key={n.title} id={`${prefix}-${i + 1}`} icon={n.icon} title={n.title} text={n.text} tag={n.tag} />)

// Two ways in (and the payment signals Razorpay already has), the five steps, and the four places an answer lands (PRD section 4). The two parts that do not exist yet
// carry the "Not built yet" tag.
function Engine() {
  const [ref, room] = useWidth<HTMLDivElement>()
  const wide = room >= COLUMNS
  const side = !wide && room >= SIDE
  const arrow = wide ? <Box display="flex" alignItems="center" justifyContent="center"><ArrowRightIcon size="large" color="surface.icon.gray.muted" /></Box> : <Box display="flex" justifyContent="center"><ArrowDownIcon size="large" color="surface.icon.gray.muted" /></Box>
  return (
    <Box ref={ref} display="grid" gap="spacing.4" alignItems="stretch" gridTemplateColumns={wide ? 'minmax(0, 1fr) 24px minmax(0, 1.1fr) 24px minmax(0, 1fr)' : 'minmax(0, 1fr)'} testID="engine">
      <Column label="Comes in" across={side ? INPUTS.length : undefined}>{nodes(INPUTS, 'engine-in')}</Column>
      {arrow}
      <Column label={`Blindspot, ${words(ENGINE.length)} steps`}>
        <Box flexGrow="1" display="flex" flexDirection="column" gap="spacing.3" padding="spacing.4" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.normal" backgroundColor="surface.background.gray.moderate">
          {ENGINE.map((name, i) => (
            <Box key={name} flexGrow="1" display="flex" alignItems="center" gap="spacing.3" padding="spacing.3" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.subtle" backgroundColor="surface.background.gray.intense" testID={`engine-step-${i + 1}`}>
              <Text size="small" weight="semibold" color="surface.text.gray.muted">{i + 1}</Text>
              <Text weight="semibold">{name}</Text>
            </Box>
          ))}
          {/* The lanes above name the steps as a merchant lives them (the story strip); these are the PRD's, where the rupee figure is a step of its own. */}
          <Text size="small" color="surface.text.gray.muted">The lanes show the steps as a merchant lives them. The engine also puts a rupee figure on every issue.</Text>
          <Text size="small" color="surface.text.gray.muted">Under every step: the problem types it knows, alert tuning and safety rules.</Text>
        </Box>
      </Column>
      {arrow}
      <Column label="Where it lands" across={side ? 2 : undefined}>{nodes(OUTPUTS, 'engine-out')}</Column>
    </Box>
  )
}

const TODAY = [
  'Rules and SQL produce every number. No AI model is run.',
  'Messages are filled from templates.',
  'The data is a made-up merchant, with known answers to check against.',
  'The hosted demo replays recorded answers.',
]
const PRODUCTION = [
  'The same rules run inside Razorpay, as an agent in Agent Studio.',
  'An AI model reads complaints in Hinglish and alerts with new error names, picks what to check on a new kind of failure, and writes the root cause.',
  'It never produces a number and never moves money. When it is unsure, it hands over.',
]

function Side({ title, tag, lines, id }: { title: string; tag: string; lines: string[]; id: string }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.4" testID={id}>
      <Box display="flex" alignItems="center" gap="spacing.4" flexWrap="wrap"><Heading as="h3" size="small">{title}</Heading><Badge size="medium" color="neutral">{tag}</Badge></Box>
      {lines.map((l) => <Text key={l} color="surface.text.gray.subtle">{l}</Text>)}
    </Box>
  )
}

export default function HowItWorks() {
  const nav = useNavigate()
  const [ref, room] = useWidth<HTMLDivElement>()
  const steps = words(STEP_NAMES.length)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Box display="flex" flexDirection="column" gap="spacing.4">
        <Crumbs items={[{ label: 'Overview', to: '/' }, { label: 'How Blindspot works', to: '/how-it-works' }]} />
        <PageHeader title="How Blindspot works" description={`A problem reaches Blindspot through a customer door or an alert door. After that it goes through the same ${steps} steps.`} />
      </Box>

      <Panel title={`${cap(words(LANES.length))} merchants, one engine`} subtitle={`A problem starts differently for each. After that the ${steps} steps are the same.`}>
        <Box display="flex" flexDirection="column" gap="spacing.7">
          {LANES.map((lane, i) => (
            <Fragment key={lane.id}>
              {i > 0 && <Box borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" />}
              <Lane lane={lane} />
            </Fragment>
          ))}
        </Box>
      </Panel>

      <Panel title="Inside the engine" subtitle={`${cap(words(DOORS))} doors and the payment signals in, ${words(ENGINE.length)} steps, ${words(OUTPUTS.length)} places the answer lands.`}>
        <Engine />
        <Text size="small" color="surface.text.gray.muted">Every channel is simulated in this prototype. No real message is sent.</Text>
      </Panel>

      <Panel title="Today and in production" subtitle="AI is the production design. No AI model runs in this prototype.">
        <Box ref={ref} display="grid" gap="spacing.7" gridTemplateColumns={room >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'}>
          <Side id="today" title="In this prototype" tag="Built" lines={TODAY} />
          <Side id="production" title="In production" tag="Design only" lines={PRODUCTION} />
        </Box>
        <Box><Button variant="tertiary" size="medium" iconPosition="right" icon={ChevronRightIcon} onClick={() => nav('/how')}>See where rules fail</Button></Box>
      </Panel>

      <Box display="flex" flexWrap="wrap" alignItems="center" gap="spacing.4">
        <Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => nav('/incidents/INC-1')}>See a payment issue</Button>
        <Button variant="tertiary" size="large" onClick={() => nav('/')}>Back to Overview</Button>
      </Box>
    </Box>
  )
}
