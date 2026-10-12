import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBreakpoint } from '@razorpay/blade/utils'
import { AlertTriangleIcon, Box, Button, ChatInput, Heading, HistoryIcon, MenuIcon, PlusIcon, RayIcon, Text, UnlockIcon, UsersIcon, useTheme, VisuallyHidden, type IconComponent } from '@razorpay/blade/components'
import { UserBubble } from '../components/AgentAnswer'
import { IncidentsAnswer, ScanAnswer } from '../components/RayAnswers'
import { RayHistory } from '../components/RayHistory'
import { addTurn, getChat, route } from '../lib/rayChats'
import { prefersReducedMotion } from '../razorsense'

const QUESTIONS: [string, IconComponent][] = [['Who paid and did not get access?', UnlockIcon], ['What is broken right now?', AlertTriangleIcon], ['Which customers wrote in?', UsersIcon]]

// Ray's chat, laid out as Razorpay's own Ray page (UI Reference, the Agentic Connected Banking recording): no side menu, a thin rail with a hamburger (the history)
// and a plus (a new chat), the merchant's message as a bubble on the right, the answer on the left in a centred column, and the input pinned at the bottom on a faint wash.
// `/ray` is a new chat (Ray's greeting, as on Razorpay's Ray home); `/ray/:id` is a saved chat.
export default function RayChat() {
  const { id } = useParams()
  const nav = useNavigate()
  const { theme } = useTheme()
  const phone = useBreakpoint({ breakpoints: theme.breakpoints }).matchedDeviceType === 'mobile'
  const [value, setValue] = useState('')
  const [history, setHistory] = useState(false)
  const [, bump] = useState(0)
  const end = useRef<HTMLDivElement>(null)
  const chat = getChat(id)
  const turns = chat?.turns ?? []

  const send = (text: string) => {
    const q = text.trim()
    if (!q) return
    const r = route(q)
    if (r.to) return nav(r.to)
    const at = addTurn(id, q, r.kind)
    setValue('')
    if (at !== id) nav(`/ray/${at}`)
    else bump((n) => n + 1)
  }
  useEffect(() => { end.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'end' }) }, [turns.length])

  // The wash behind the input: a faint blue and green rising from the bottom edge, from Blade's tokens (as Razorpay's chat pages have).
  const c = theme.colors
  const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`
  const wash = `linear-gradient(to top, ${tint(c.interactive.background.primary.default, 14)}, ${tint(c.feedback.background.positive.intense, 8)} 55%, transparent)`

  const input = (
    <ChatInput value={value} onChange={({ value }) => setValue(value)} onSubmit={({ value }) => send(value)} placeholder="Ask Ray anything about your payments" accessibilityLabel="Ask Ray" hideFileUpload autoFocus={!phone} />
  )
  return (
    <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} flex="1" testID="ray-thread">
      <RayHistory isOpen={history} onClose={() => setHistory(false)} />
      {/* The rail: a column down the left on a tablet or wider, a row across the top on a phone. It stays in view while a long thread scrolls (sticky), so the
          history and a new chat are always one tap away. The two buttons are 36px squares, and a phone shows the history clock, not a second hamburger beside the top bar's. */}
      <Box position={{ base: 'sticky', m: 'static' }} top="spacing.0" zIndex={1} backgroundColor="surface.background.gray.intense" borderRightWidth={{ base: 'none', m: 'thin' }} borderBottomWidth={{ base: 'thin', m: 'none' }} borderLeftWidth="none" borderTopWidth="none" borderColor="surface.border.gray.subtle">
        <Box position={{ base: 'static', m: 'sticky' }} top="spacing.0" display="flex" flexDirection={{ base: 'row', m: 'column' }} gap="spacing.4" padding="spacing.4">
          <Button variant="tertiary" size="medium" icon={phone ? HistoryIcon : MenuIcon} accessibilityLabel="Chat history" onClick={() => setHistory(true)} />
          <Button variant="secondary" size="medium" icon={PlusIcon} accessibilityLabel="New chat" onClick={() => { setValue(''); nav('/ray') }} />
        </Box>
      </Box>
      <Box flex="1" minWidth="0px" display="flex" flexDirection="column">
        {turns.length === 0 ? (
          <Box flex="1" display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="spacing.6" padding={{ base: 'spacing.5', m: 'spacing.7' }}>
            <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.3">
              <Text color="surface.text.gray.muted">Hello, Kaksha</Text>
              <Box display="flex" alignItems="center" gap="spacing.4"><RayIcon size="2xlarge" color="surface.icon.onSea.onSubtle" /><Heading as="h1" size="2xlarge">How can I help you?</Heading></Box>
            </Box>
            <Box width="100%" maxWidth="720px" display="flex" flexDirection="column" gap="spacing.5">
              {input}
              <Box display="flex" flexWrap="wrap" justifyContent="center" gap="spacing.3">
                {QUESTIONS.map(([q, icon]) => <Button key={q} variant="secondary" size="small" icon={icon} onClick={() => send(q)}>{q}</Button>)}
              </Box>
            </Box>
          </Box>
        ) : (
          <>
            <Box flex="1" width="100%" maxWidth="720px" marginX="auto" display="flex" flexDirection="column" gap="spacing.7" padding={{ base: 'spacing.5', m: 'spacing.7' }}>
              <VisuallyHidden><Heading as="h1">Ray chat</Heading></VisuallyHidden>
              {turns.map((t, i) => (
                <Box key={i} display="flex" flexDirection="column" gap="spacing.7">
                  <UserBubble>{t.q}</UserBubble>
                  {t.kind === 'scan' ? <ScanAnswer /> : <IncidentsAnswer />}
                </Box>
              ))}
              <Box ref={end} />
            </Box>
            <Box position="sticky" bottom="spacing.0" backgroundColor="surface.background.gray.moderate" paddingX={{ base: 'spacing.5', m: 'spacing.7' }} paddingTop="spacing.7" paddingBottom="spacing.5">
              <div style={{ position: 'absolute', inset: 0, background: wash, pointerEvents: 'none' }} />
              {/* A white surface of its own, so the answer scrolling underneath never shows through the input. */}
              <Box position="relative" width="100%" maxWidth="720px" marginX="auto" backgroundColor="surface.background.gray.intense" borderRadius="large">{input}</Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}
