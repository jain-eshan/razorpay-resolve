import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, AlertTriangleIcon, ArrowLeftIcon, Box, Button, ChatInput, Heading, HistoryIcon, PlusIcon, RayIcon, Text, UnlockIcon, UsersIcon, useTheme, VisuallyHidden, type IconComponent } from '@razorpay/blade/components'
import { AgentAnswer, UserBubble } from '../components/AgentAnswer'
import { IncidentsAnswer, ScanAnswer } from '../components/RayAnswers'
import { RayHistory } from '../components/RayHistory'
import { addTurn, getChat, route } from '../lib/rayChats'
import { prefersReducedMotion } from '../razorsense'

const QUESTIONS: [string, IconComponent][] = [['Who paid and did not get access?', UnlockIcon], ['What is broken right now?', AlertTriangleIcon], ['Which customers wrote in?', UsersIcon]]

// Ray's chat page. The thread, the answer cards and the pinned input follow Razorpay's own Ray page (UI Reference, the Agentic Connected Banking recording).
// The side menu stays, unlike on Razorpay's page: this is one page of Blindspot, reached from the Overview, and the side menu is the way to every other page. So the
// journey is: the Overview asks, this page answers, "Overview" (and the menu) goes back, "History" lists the earlier chats, "New chat" starts a fresh one.
// `/ray` is a new chat (Ray's greeting, as on Razorpay's Ray home); `/ray/:id` is a saved chat.
export default function RayChat() {
  const { id } = useParams()
  const nav = useNavigate()
  const { theme } = useTheme()
  const [value, setValue] = useState('')
  const [history, setHistory] = useState(false)
  const [, bump] = useState(0)
  const end = useRef<HTMLDivElement>(null)
  const chat = getChat(id)
  const turns = chat?.turns ?? []
  const lost = !!id && !chat  // an address from another browser, or after the history was cleared

  const send = (text: string) => {
    const q = text.trim()
    if (!q) return
    const r = route(q)
    if (r.to) return nav(r.to)
    const at = addTurn(chat ? id : undefined, q, r.kind)
    setValue('')
    if (at !== id) nav(`/ray/${at}`, { replace: lost })
    else bump((n) => n + 1)
  }
  useEffect(() => { end.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'end' }) }, [turns.length])

  // The wash behind the input: a faint blue and green rising from the bottom edge, from Blade's tokens (as Razorpay's chat pages have).
  const c = theme.colors
  const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`
  const wash = `linear-gradient(to top, ${tint(c.interactive.background.primary.default, 14)}, ${tint(c.feedback.background.positive.intense, 8)} 55%, transparent)`

  const input = (
    <ChatInput value={value} onChange={({ value }) => setValue(value)} onSubmit={({ value }) => send(value)} placeholder="Ask Ray anything about your payments" accessibilityLabel="Ask Ray" hideFileUpload autoFocus />
  )
  const questions = (
    <Box display="flex" flexWrap="wrap" justifyContent="center" gap="spacing.3">
      {QUESTIONS.map(([q, icon]) => <Button key={q} variant="secondary" size="small" icon={icon} onClick={() => send(q)}>{q}</Button>)}
    </Box>
  )

  return (
    <Box display="flex" flexDirection="column" flex="1" testID="ray-thread">
      <RayHistory isOpen={history} onClose={() => setHistory(false)} />
      {/* The toolbar stays at the top while a long thread scrolls: the way back, the history and a new chat are always in reach. It sits above the answers' own
          buttons (Blade buttons carry z-index 1 to 2), so an answer scrolling underneath is never drawn over it. */}
      <Box position="sticky" top="spacing.0" zIndex={5} backgroundColor="surface.background.gray.moderate" paddingX={{ base: 'spacing.5', m: 'spacing.7' }} paddingY="spacing.4">
        <Box width="100%" maxWidth="720px" marginX="auto" display="flex" alignItems="center" justifyContent="space-between" gap="spacing.3">
          <Button variant="tertiary" size="medium" icon={ArrowLeftIcon} onClick={() => nav('/')}>Overview</Button>
          <Box display="flex" gap="spacing.3">
            <Button variant="secondary" size="medium" icon={HistoryIcon} onClick={() => setHistory(true)}>History</Button>
            <Button variant="secondary" size="medium" icon={PlusIcon} onClick={() => { setValue(''); nav('/ray') }}>New chat</Button>
          </Box>
        </Box>
      </Box>
      {turns.length === 0 ? (
        <Box flex="1" display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="spacing.6" padding={{ base: 'spacing.5', m: 'spacing.7' }}>
          <VisuallyHidden><Heading as="h1">Ray chat</Heading></VisuallyHidden>
          {lost && <Box width="100%" maxWidth="720px"><Alert isFullWidth isDismissible={false} color="information" description="That chat is not saved in this browser. Chats are kept where they were asked. Start a new one below." /></Box>}
          <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.3">
            <Text color="surface.text.gray.muted">Hello, Kaksha</Text>
            <Box display="flex" alignItems="center" gap="spacing.4"><RayIcon size="2xlarge" color="surface.icon.onSea.onSubtle" /><Heading as="h2" size="2xlarge">How can I help you?</Heading></Box>
          </Box>
          <Box width="100%" maxWidth="720px" display="flex" flexDirection="column" gap="spacing.5">
            {input}
            {questions}
          </Box>
        </Box>
      ) : (
        <>
          <Box flex="1" width="100%" maxWidth="720px" marginX="auto" display="flex" flexDirection="column" gap="spacing.7" padding={{ base: 'spacing.5', m: 'spacing.7' }}>
            <VisuallyHidden><Heading as="h1">Ray chat</Heading></VisuallyHidden>
            {turns.map((t, i) => (
              <Box key={i} display="flex" flexDirection="column" gap="spacing.7">
                <UserBubble>{t.q}</UserBubble>
                {t.kind === 'scan' ? <ScanAnswer /> : t.kind === 'incidents' ? <IncidentsAnswer /> : (
                  // Ray is a router over the data, not a model, so it says so and offers what it can answer instead of guessing.
                  <AgentAnswer title="I can answer from your payment data" text="Ask me who paid and did not get access, what is broken right now, or which customers wrote in." next={QUESTIONS.map(([q]) => ({ label: q, onClick: () => send(q) }))}>{null}</AgentAnswer>
                )}
              </Box>
            ))}
            <Box ref={end} />
          </Box>
          {/* The dock sits above the answers (z-index 5, over the buttons' 1 and 2) on the page colour, with a white surface for the input, so nothing shows through it. */}
          <Box testID="ray-dock" position="sticky" bottom="spacing.0" zIndex={5} backgroundColor="surface.background.gray.moderate" paddingX={{ base: 'spacing.5', m: 'spacing.7' }} paddingTop="spacing.7" paddingBottom="spacing.5">
            <div style={{ position: 'absolute', inset: 0, background: wash, pointerEvents: 'none' }} />
            <Box position="relative" width="100%" maxWidth="720px" marginX="auto" backgroundColor="surface.background.gray.intense" borderRadius="large">{input}</Box>
          </Box>
        </>
      )}
    </Box>
  )
}
