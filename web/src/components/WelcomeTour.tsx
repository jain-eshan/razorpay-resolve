import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon, Box, Button, Modal, ModalBody, ModalFooter, Text, Heading } from '@razorpay/blade/components'
import { ART, HERO, type ArtId } from '../lib/art'
import { useHeroWash } from './iso'

// The first thing a new merchant sees: what Blindspot is, in three short steps, then straight into setup.
// When it opens on its own: lib/setup.ts (welcomeDue).

// A mask, not a colour: only its opacity matters. An ellipse fades every edge, so a spot's own background melts into the wash whether the strip is wider than the picture (desktop) or taller (phone).
const FADE = 'radial-gradient(ellipse 50% 50% at center, black 62%, transparent 100%)'

// The three cards use the product's own words (docs/PRD_V3.md, section 1): the problem, then the five things it does, then the approval rule. Each claim is
// something Blindspot does today. A new line is checked against the PRD first.
// Every sentence names its subject (Blindspot, you, your customers): a merchant reads this once, on the first visit, with nothing before it to point back to.
const STEPS: { art: ArtId | 'hero'; title: string; text: string }[] = [
  { art: 'hero', title: 'Find every customer a payment problem hit', text: 'Most customers whose payment fails once never try again, and most never complain. Blindspot spots the problem in your customers\' messages or your payment data, then finds every customer the problem hit, including the ones who never wrote in.' },
  { art: 'proof', title: 'Know whose side it is, with proof', text: 'Before naming a cause, Blindspot checks where the failed payments pile up: one app version, one payment method, one error code. Then Blindspot says whether the cause is your code, your settings, Razorpay or the bank, and what the problem cost you in rupees.' },
  { art: 'approve', title: 'Fix it and win customers back, with your approval', text: 'Blindspot fixes what Razorpay can fix, in small steps, and messages the customers who dropped off. No money moves and no customer gets a message until you approve. Blindspot never asks anyone for a password, card number or OTP.' },
]

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const wash = useHeroWash()
  const s = STEPS[step]
  const last = step === STEPS.length - 1
  const close = () => { onClose(); setStep(0) }
  const pic = s.art === 'hero' ? HERO.blindspot : ART[s.art]
  const primary = useRef<HTMLButtonElement>(null)
  return (
    <Modal isOpen={open} onDismiss={close} size="medium" accessibilityLabel="Welcome to Blindspot" initialFocusRef={primary}>
      <ModalBody padding="spacing.0">
        {/* The picture and the text keep one height on every step, so the window does not jump as you go through it. */}
        <Box position="relative" height={{ base: '200px', m: '240px' }} display="flex" alignItems="center" justifyContent="center" overflow="hidden">
          <div style={{ position: 'absolute', inset: 0, background: wash }} />
          {/* Every picture is shown whole. The strip is wider than any picture, so a 2:1 spot's own background fades into the wash at its sides instead of ending in a hard edge. */}
          <Box position="relative" height="100%" width="100%" display="flex" justifyContent="center" padding={s.art === 'hero' ? 'spacing.5' : 'spacing.0'}>
            <img src={pic.src} alt={pic.alt} style={{ display: 'block', height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain', ...(s.art === 'hero' ? {} : { maskImage: FADE, WebkitMaskImage: FADE }) }} />
          </Box>
        </Box>
        <Box padding="spacing.6" display="flex" flexDirection="column" gap="spacing.3" minHeight={{ base: '252px', m: '168px' }} testID="welcome-step">
          <Text size="small" weight="semibold" color="surface.text.gray.muted">{`Welcome to Blindspot · ${step + 1} of ${STEPS.length}`}</Text>
          <Heading as="h2" size="large">{s.title}</Heading>
          <Text color="surface.text.gray.subtle" testID="welcome-text">{s.text}</Text>
        </Box>
      </ModalBody>
      <ModalFooter>
        <Box display="flex" justifyContent="space-between" alignItems="center" gap="spacing.4" flexWrap="wrap">
          {step === 0 ? <Button variant="tertiary" onClick={close}>Look around first</Button> : <Button variant="tertiary" onClick={() => setStep(step - 1)}>Back</Button>}
          {last
            ? <Button ref={primary} variant="primary" iconPosition="right" icon={ArrowRightIcon} onClick={() => { close(); nav('/setup') }}>Set up in 3 steps</Button>
            : <Button ref={primary} variant="primary" iconPosition="right" icon={ArrowRightIcon} onClick={() => setStep(step + 1)}>Next</Button>}
        </Box>
      </ModalFooter>
    </Modal>
  )
}
