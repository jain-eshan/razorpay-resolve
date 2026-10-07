import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Card, CardBody, Checkbox, CheckboxGroup, Heading, Link, Radio, RadioGroup, StepGroup, StepItem, StepItemIndicator, Text } from '@razorpay/blade/components'
import { rupees, useGet, type Schemas } from '../lib/api'
import { saveSetup, setupDone } from '../lib/setup'

const CHANNELS = [['help_button', 'Help button on Razorpay pages'], ['whatsapp_payments', 'WhatsApp payments number'], ['email', 'Email']] as const
const LEVELS = [
  ['suggest', 'Suggest', 'You approve every step: the dry run, the first 5, the rest, and every message.'],
  ['assist', 'Assist', 'You approve a fix once. It then runs in stages by itself and stops if anything fails. Messages still need you.'],
  ['autopilot_reversible', 'Autopilot', 'Fixes and messages run by themselves within your limits. Use it only when you trust the wording.'],
] as const
const STEPS = ['Channels', 'Autonomy', 'First scan']

// First run, in the layout of Razorpay's merchant onboarding (stepper on the left, one question per screen, one blue Continue). It asks for no credentials.
// Choices are not saved: Blindspot's settings are read-only in this prototype. Only how far you got is remembered, in the browser.
export default function Setup() {
  const nav = useNavigate()
  const [step, setStep] = useState(Math.min(setupDone(), STEPS.length - 1))
  const [channels, setChannels] = useState<string[]>(['help_button', 'whatsapp_payments', 'email'])
  const [level, setLevel] = useState<string>('suggest')
  const { data: scan } = useGet<Schemas['ScanResult']>(step === 2 ? '/api/scan/day0' : null)

  const next = () => {
    saveSetup(Math.max(setupDone(), step + 1))
    if (step === 2) nav('/scan')
    else setStep(step + 1)
  }
  const body: ReactNode[] = [
    <CheckboxGroup key="c" label="Channels" value={channels} onChange={({ values }) => setChannels(values)}>
      {CHANNELS.map(([k, label]) => <Checkbox key={k} value={k}>{label}</Checkbox>)}
    </CheckboxGroup>,
    <RadioGroup key="a" label="How much should Blindspot do on its own?" value={level} onChange={({ value }) => setLevel(value)}>
      {LEVELS.map(([k, label, help]) => <Radio key={k} value={k} helpText={help}>{label}</Radio>)}
    </RadioGroup>,
    scan ? (
      <Alert key="s" isFullWidth isDismissible={false} color={scan.leaked_customers ? 'notice' : 'positive'} title={scan.headline}
        description={`${scan.leaked_customers} customers paid and have no access, ${rupees(scan.leaked_paise)} in total. Nothing has been changed.`} />
    ) : <Text key="s" color="surface.text.gray.muted">Checking Razorpay's records against your access records</Text>,
  ]
  const copy = [
    ['Where can customers reach you?', 'Blindspot only listens where you connect it. You can change this any time in Channels.'],
    ['How much should it do on its own?', 'Start with Suggest. You can raise it later in Settings.'],
    ['Run your first scan', 'It compares Razorpay\'s records with yours. It only looks.'],
  ]

  return (
    <Box display="grid" gridTemplateColumns={{ base: '1fr', l: '280px minmax(0, 1fr)' }} gap="spacing.6" alignItems="start" testID="setup">
      <Card>
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.5">
            <Box display="flex" flexDirection="column"><Text color="surface.text.gray.muted">Setup:</Text><Heading size="medium">Blindspot</Heading></Box>
            <StepGroup size="medium">
              {STEPS.map((t, i) => <StepItem key={t} title={t} stepProgress={i < step ? 'full' : 'none'} marker={<StepItemIndicator color={i < step ? 'positive' : i === step ? 'primary' : 'neutral'} />} />)}
            </StepGroup>
          </Box>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.6" maxWidth="560px" minHeight="360px">
            {step > 0 && <Box><Link href="#" onClick={(e) => { e.preventDefault(); setStep(step - 1) }}>Back</Link></Box>}
            <Box display="flex" flexDirection="column" gap="spacing.2">
              <Heading size="xlarge">{copy[step][0]}</Heading>
              <Text color="surface.text.gray.muted">{copy[step][1]}</Text>
            </Box>
            {body[step]}
            <Box display="flex" flexDirection="column" gap="spacing.4" marginTop="auto">
              <Button variant="primary" size="large" isFullWidth onClick={next} isDisabled={step === 2 && !scan}>{step === 2 ? 'See what I found' : 'Continue'}</Button>
              <Text size="small" color="surface.text.gray.muted">Your choices are not saved in this demo. Blindspot never asks for passwords, card details or OTPs.</Text>
            </Box>
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}
