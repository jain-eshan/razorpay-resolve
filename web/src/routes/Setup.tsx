import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, ArrowLeftIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, Heading, HeadsetIcon, Link, MailIcon, SlidersIcon, StepGroup, StepItem, StepItemIndicator, Text, UserCheckIcon, WhatsAppIcon, ZapIcon, type IconComponent } from '@razorpay/blade/components'
import { SetupScene } from '../components/SetupScene'
import { rupees, useGet, type Schemas } from '../lib/api'
import { saveSetup, SETUP_STEP_HELP, SETUP_STEP_NAMES, setupDone } from '../lib/setup'

const CHANNELS: [string, string, string, IconComponent][] = [
  ['help_button', 'Help button', 'Customers tap help on a Razorpay page or receipt.', HeadsetIcon],
  ['whatsapp_payments', 'WhatsApp', 'Customers message your payments number.', WhatsAppIcon],
  ['email', 'Email', 'Customers write to your payments address.', MailIcon],
]
const LEVELS: [string, string, string, IconComponent][] = [
  ['suggest', 'Review first', 'You approve every step: the test run, the first 5, the rest, and every message.', UserCheckIcon],
  ['assist', 'Approve once', 'You approve a fix once. It then goes out in steps by itself and stops if anything fails. Messages still need you.', SlidersIcon],
  ['autopilot_reversible', 'Full automation', 'Fixes and messages go out by themselves within your limits. Use it only when you trust the wording.', ZapIcon],
]
const STEPS = SETUP_STEP_NAMES
// A line under the choices on the first two steps: what stays true whatever you pick.
const NOTE = ['Blindspot reads only messages about a payment, says it is an AI in every reply, and never asks a customer for a password, card details or an OTP.', 'Whatever you pick, switching a customer’s access off is never available.', '']
const STEP_HELP = SETUP_STEP_HELP

// A card you can pick, with an icon, a title, one line and a tick. Used for channels (pick any) and autonomy levels (pick one).
function Choice({ icon: Icon, title, text, selected, onPick, badge }: { icon: IconComponent; title: string; text: string; selected: boolean; onPick: () => void; badge?: string }) {
  return (
    <Card isSelected={selected} onClick={onPick} accessibilityLabel={selected ? `${title}, selected` : title} height="100%">
      <CardBody>
        <Box display="flex" flexDirection="column" gap="spacing.4">
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box width="40px" height="40px" borderRadius="max" backgroundColor="surface.background.primary.subtle" display="flex" alignItems="center" justifyContent="center">
              <Icon size="large" color="surface.icon.primary.normal" />
            </Box>
            {selected ? <CheckCircleIcon size="large" color="surface.icon.primary.normal" /> : <Box width="20px" height="20px" borderRadius="max" borderWidth="thin" borderColor="surface.border.gray.normal" />}
          </Box>
          <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap"><Heading as="h2" size="small">{title}</Heading>{badge && <Badge size="small" color="positive">{badge}</Badge>}</Box>
          <Text color="surface.text.gray.muted">{text}</Text>
        </Box>
      </CardBody>
    </Card>
  )
}

// First run, in the layout of Razorpay's merchant onboarding (stepper on the left, one question per screen, one blue Continue). It asks for no credentials.
// Choices are not saved: Blindspot's settings are read-only in this prototype. Only how far you got is remembered, in the browser.
export default function Setup() {
  const nav = useNavigate()
  // `?step=` opens a step you have already reached (the tiles on the Overview link to it); otherwise setup resumes at the next step.
  const param = useSearchParams()[0].get('step')
  const asked = param === null ? -1 : Number(param)
  const [step, setStep] = useState(Number.isInteger(asked) && asked >= 0 && asked <= setupDone() && asked < STEPS.length ? asked : Math.min(setupDone(), STEPS.length - 1))
  const [channels, setChannels] = useState<string[]>(['help_button', 'whatsapp_payments', 'email'])
  const [level, setLevel] = useState<string>('suggest')
  const { data: scan } = useGet<Schemas['ScanResult']>(step === 2 ? '/api/scan/day0' : null)

  const next = () => {
    saveSetup(Math.max(setupDone(), step + 1))
    if (step === 2) nav('/scan')
    else setStep(step + 1)
  }
  const toggle = (k: string) => setChannels(channels.includes(k) ? channels.filter((c) => c !== k) : [...channels, k])
  const body: ReactNode[] = [
    <Box key="c" display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
      {CHANNELS.map(([k, title, text, icon]) => <Choice key={k} icon={icon} title={title} text={text} selected={channels.includes(k)} onPick={() => toggle(k)} />)}
    </Box>,
    <Box key="a" display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
      {LEVELS.map(([k, title, text, icon]) => <Choice key={k} icon={icon} title={title} text={text} selected={level === k} onPick={() => setLevel(k)} badge={k === 'suggest' ? 'Start here' : undefined} />)}
    </Box>,
    scan ? (
      <Box key="s" display="flex" flexDirection="column" gap="spacing.5">
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))' }} gap="spacing.5">
          {[[String(scan.leaked_customers), 'customers paid and have no access'], [rupees(scan.leaked_paise), 'paid by those customers']].map(([v, l]) => (
            <Box key={l} backgroundColor="surface.background.gray.subtle" borderRadius="medium" padding="spacing.6" display="flex" flexDirection="column" gap="spacing.2">
              <Heading size="2xlarge">{v}</Heading>
              <Text color="surface.text.gray.muted">{l}</Text>
            </Box>
          ))}
        </Box>
        <Alert isFullWidth isDismissible={false} color={scan.leaked_customers ? 'notice' : 'positive'} title={scan.headline} description="Nothing has been changed." />
      </Box>
    ) : <Text key="s" color="surface.text.gray.muted">Checking Razorpay's records against your access records</Text>,
  ]
  const copy = [
    ['Where can customers reach you?', 'Blindspot only listens where you connect it. Pick any you want. You can change this any time in Connectors.'],
    ['How much should it do on its own?', 'Start with Review first. You can change it later in Settings.'],
    ['See what is already broken', "Blindspot compares the last 30 days of Razorpay's records with yours. It only looks."],
  ]

  return (
    <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: '300px minmax(0, 1fr)' }} gap="spacing.6" alignItems="stretch" testID="setup">
      <Box display={{ base: 'none', l: 'block' }}>
        <Card height="100%">
          <CardBody>
            <Box display="flex" flexDirection="column" gap="spacing.6" height="100%">
              <Box display="flex" flexDirection="column"><Text color="surface.text.gray.muted">Setup:</Text><Heading as="h2" size="medium">Blindspot</Heading></Box>
              <StepGroup size="large">
                {STEPS.map((t, i) => <StepItem key={t} title={t} description={STEP_HELP[i]} stepProgress={i < step ? 'full' : 'none'} marker={<StepItemIndicator color={i < step ? 'positive' : i === step ? 'primary' : 'neutral'} />} />)}
              </StepGroup>
              <Box marginTop="auto"><SetupScene step={step} channels={channels} level={level} /></Box>
            </Box>
          </CardBody>
        </Card>
      </Box>
      <Card height="100%">
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.6" minHeight={{ base: 'auto', m: '480px' }} height="100%">
            {/* One row above the heading on every step, so the heading never moves: Back once there is a step to go back to, and where you are. */}
            <Box display="flex" alignItems="center" gap="spacing.4" minHeight="20px">
              {step > 0 && <Link href="#" icon={ArrowLeftIcon} onClick={(e) => { e.preventDefault(); setStep(step - 1) }}>Back</Link>}
              <Text size="small" weight="semibold" color="surface.text.gray.muted">{`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}</Text>
            </Box>
            <Box display="flex" flexDirection="column" gap="spacing.2">
              <Heading as="h1" size="xlarge">{copy[step][0]}</Heading>
              <Text color="surface.text.gray.muted">{copy[step][1]}</Text>
            </Box>
            {body[step]}
            {NOTE[step] && <Alert isFullWidth isDismissible={false} color="information" description={NOTE[step]} />}
            <Box display="flex" flexDirection="column" gap="spacing.4" marginTop="auto">
              <Button variant="primary" size="large" isFullWidth onClick={next} isDisabled={step === 2 && !scan}>{step === 2 ? 'See what I found' : 'Continue'}</Button>
              <Text size="small" color="surface.text.gray.muted">{step < 2 ? 'Your choices are not saved in this demo. ' : ''}Blindspot never asks for passwords, card details or OTPs.</Text>
            </Box>
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}
