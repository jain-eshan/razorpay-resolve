import { useMemo, useState } from 'react'
import { m } from 'framer-motion'
import {
  Alert,
  Box,
  Button,
  Card,
  CardBody,
  ChatInput,
  ChatMessage,
  CheckIcon,
  CopyIcon,
  Display,
  Heading,
  IconButton,
  RayIcon,
  RazorSense,
  RazorSenseGradient,
  RazorpayIcon,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  ThumbsUpIcon,
  preloadRazorSenseAssets,
} from '@razorpay/blade/components'
import { RAY_GLYPH, emotions, gradientCanvas, prefersReducedMotion, type Emotion } from './razorsense'

export default function App() {
  return (
    <Box backgroundColor="surface.background.gray.moderate" minHeight="100vh">
      <Box
        display="flex"
        alignItems="center"
        gap="spacing.3"
        paddingX={{ base: 'spacing.5', m: 'spacing.9' }}
        paddingY="spacing.5"
      >
        <RazorpayIcon size="large" color="interactive.icon.primary.normal" />
        <Text weight="semibold">RazorSense starter</Text>
      </Box>

      <Box
        maxWidth="1080px"
        marginX="auto"
        paddingX={{ base: 'spacing.5', m: 'spacing.9' }}
        paddingBottom="spacing.11"
        display="flex"
        flexDirection="column"
        gap="spacing.11"
      >
        <Hero />
        <States />
        <AskRay />
        <SuccessMoment />
      </Box>
    </Box>
  )
}

function Hero() {
  const [emotion, setEmotion] = useState<Emotion>('calm')
  // One canvas per state; RazorSense re-uploads the texture when the canvas reference changes.
  const maps = useMemo(
    () => Object.fromEntries(Object.entries(emotions).map(([k, v]) => [k, gradientCanvas(v.stops)])) as Record<Emotion, HTMLCanvasElement>,
    [],
  )

  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Box display="flex" flexDirection="column" gap="spacing.4" maxWidth="720px">
        <Display size="medium" weight="regular">
          Every state has a feeling.
        </Display>
        <Text size="large" color="surface.text.gray.muted">
          RazorSense is Razorpay's design language for the AI era. Colour, shape and motion respond to what the
          person is going through. Switch the state to see the flutes change.
        </Text>
      </Box>

      <Box position="relative" height={{ base: '360px', m: '480px' }} borderRadius="large" overflow="hidden">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(105deg, ${emotions[emotion].fallback})`,
            transition: 'background 480ms',
          }}
        />
        <RazorSense gradientMapCanvas={maps[emotion]} paused={prefersReducedMotion || emotions[emotion].paused} />
      </Box>

      <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} gap="spacing.5" alignItems={{ m: 'flex-end' }}>
        <SegmentedControl
          label="Emotional state"
          name="emotion"
          value={emotion}
          onChange={({ value }) => setEmotion(value as Emotion)}
        >
          {Object.entries(emotions).map(([k, v]) => (
            <SegmentedControlItem key={k} value={k}>
              {v.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <Text color="surface.text.gray.muted">Use for: {emotions[emotion].useFor}</Text>
      </Box>
    </Box>
  )
}

function States() {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Heading size="large">How each state sounds</Heading>
      <Box display="grid" gridTemplateColumns={{ base: '1fr', m: '1fr 1fr' }} gap="spacing.5">
        <Alert color="information" isDismissible={false} title="Calm" description="₹2,40,000 settles tomorrow by 11 AM." />
        <Alert color="positive" isDismissible={false} title="Joyful" description="Payment received. ₹94,600 from Kiran Stores." />
        <Alert
          color="notice"
          isDismissible={false}
          title="Caution"
          description="This refund can't be undone. ₹12,500 goes back to the customer's card in 5–7 days."
        />
        <Alert
          color="negative"
          isDismissible={false}
          title="Regret"
          description="We couldn't reach HDFC Bank, so your customer wasn't charged. Ask them to retry with UPI."
        />
      </Box>
    </Box>
  )
}

const STEPS = [
  { label: 'Reading your settlement schedule', completedLabel: 'Read settlement schedule' },
  { label: 'Checking bank holidays', completedLabel: 'Found a bank holiday on Tuesday' },
  { label: 'Comparing instant settlement fee', completedLabel: 'Instant settlement costs ₹120' },
]

type Message = { id: number; from: 'self' | 'other'; text: string }

function AskRay() {
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'other', text: 'Hi, I’m Ray. Ask me about payments, settlements or refunds.' },
  ])
  const [step, setStep] = useState<number | null>(null)

  // Demo only: every question gets the same scripted answer so the thinking state is visible.
  const ask = ({ value }: { value: string }) => {
    if (!value.trim()) return
    setMessages((prev) => [...prev, { id: prev.length, from: 'self', text: value }])
    setValue('')
    STEPS.forEach((_, i) => setTimeout(() => setStep(i), i * 1100))
    setTimeout(() => {
      setStep(null)
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length,
          from: 'other',
          text: 'Your ₹94,600 settles Wednesday. Tuesday is a bank holiday, so I can settle it today for a ₹120 fee. Want me to?',
        },
      ])
    }, STEPS.length * 1100)
  }

  const ray = <RayIcon size="xlarge" color="surface.icon.onSea.onSubtle" />

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="large">Ask Ray</Heading>
        <Text color="surface.text.gray.muted">Blue is for what you do. Green is for what Ray thinks.</Text>
      </Box>
      <Card>
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.7" maxWidth="640px" marginX="auto">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                senderType={msg.from}
                leading={msg.from === 'other' ? ray : undefined}
                footerActions={
                  msg.from === 'other' && msg.id > 0 ? (
                    <Box display="flex" gap="spacing.2">
                      <IconButton icon={CopyIcon} accessibilityLabel="Copy answer" onClick={() => navigator.clipboard.writeText(msg.text)} />
                      <IconButton icon={ThumbsUpIcon} accessibilityLabel="Helpful" onClick={() => {}} />
                    </Box>
                  ) : undefined
                }
              >
                {msg.text}
              </ChatMessage>
            ))}
            {step !== null && (
              <ChatMessage
                senderType="other"
                leading={ray}
                isLoading
                loadingText={['Thinking…', 'Checking your account…']}
                reasoningTraces={STEPS}
                reasoningStatus="loading"
                reasoningActiveStepIndex={step}
                reasoningTitle="Ray is thinking"
              />
            )}
            <ChatInput
              value={value}
              onChange={({ value }) => setValue(value)}
              onSubmit={ask}
              isGenerating={step !== null}
              onStop={() => setStep(null)}
              placeholder="Ask Ray anything related to Razorpay"
              suggestions={['When will my money settle?', 'Why did this payment fail?', 'Refund order #4821']}
              onSuggestionAccept={({ suggestion }) => setValue(suggestion)}
              accessibilityLabel="Ask Ray"
            />
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}

function SuccessMoment() {
  const [state, setState] = useState<'idle' | 'loading' | 'shown'>('idle')

  const show = () => {
    setState('loading')
    preloadRazorSenseAssets('circleSlideUp')
      .then(() => setState('shown'))
      .catch(() => setState('shown'))
  }

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="large">Joyful, in full</Heading>
        <Text color="surface.text.gray.muted">
          The living surface is rationed for moments like this one: success, AI loading, login, hero.
        </Text>
      </Box>
      <Box
        position="relative"
        height="520px"
        borderRadius="large"
        overflow="hidden"
        backgroundColor="surface.background.gray.intense"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {state === 'shown' ? (
          <>
            <Box position="absolute" top="0px" left="0px" right="0px" bottom="0px">
              <RazorSense preset="circleSlideUp" edgeFeather={[0, 0, 0.2, 0]} paused={prefersReducedMotion} />
            </Box>
            <m.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
              style={{ position: 'relative', textAlign: 'center' }}
            >
              <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.5">
                <Box
                  backgroundColor="feedback.background.positive.subtle"
                  borderRadius="max"
                  width="80px"
                  height="80px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <CheckIcon size="2xlarge" color="feedback.icon.positive.intense" />
                </Box>
                <Heading size="xlarge">Settlement scheduled</Heading>
                <Text color="surface.text.gray.muted">₹94,600 reaches your HDFC account today by 6 PM.</Text>
                <Button variant="secondary" onClick={() => setState('idle')}>
                  Done
                </Button>
              </Box>
            </m.div>
          </>
        ) : (
          <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.7">
            <RazorSenseGradient size={56}>
              <path d={RAY_GLYPH} fill="white" />
            </RazorSenseGradient>
            <Button size="large" isLoading={state === 'loading'} onClick={show}>
              Settle ₹94,600 now
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
