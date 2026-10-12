import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, ChatInput, ChevronRightIcon, Divider, Heading, Link, Modal, ModalBody, ModalFooter, ModalHeader, PlusIcon, RayIcon, RupeesIcon, Text, TextInput, UnlockIcon, UsersIcon, type IconComponent } from '@razorpay/blade/components'
import { IssuesChart } from '../components/IssuesChart'
import { MenuPick } from '../components/MenuPick'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { SetupCard } from '../components/SetupCard'
import { Stat } from '../components/Stat'
import { WelcomeTour } from '../components/WelcomeTour'
import { rupees, useGet, type Schemas } from '../lib/api'
import { IncidentsAnswer, ScanAnswer } from '../components/RayAnswers'
import { cause, headline } from '../lib/format'
import { GUIDES } from '../lib/guides'
import { inRange, parseRange, RANGES, type RangeId } from '../lib/range'
import { markWelcomed, resetSetup, setupDone, SETUP_STEPS, welcomeDue } from '../lib/setup'
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
const QUESTIONS: [string, IconComponent][] = [['Who paid and did not get access?', UnlockIcon], ['What is broken right now?', AlertTriangleIcon], ['Which customers wrote in?', UsersIcon]]
// Orange when the fix is yours, neutral when it is someone else's (the same as the Payment issues page).
const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'neutral', bank: 'neutral', customer: 'neutral', unknown: 'neutral' } as const

// The Blindspot overview, laid out like the dashboard's own home: a date range, Ray's bar, the setup card until setup is done, four cards, one chart,
// the open issues by money at stake, then the pages. Every figure is added up in the browser from the issue summaries the API returns.
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
  const [done, setDone] = useState(setupDone)
  const [welcome, setWelcome] = useState(welcomeDue)
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(markWelcomed, [])
  // The range lives in the address (?range=7d), so a reload or a shared link keeps it.
  const [params, setParams] = useSearchParams()
  const range = parseRange(params.get('range'))
  const pickRange = (id: RangeId) => setParams((p) => { p.set('range', id); return p }, { replace: true })
  const { data: incs, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
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
  if (!incs && !error) return <PageSkeleton />

  const issues = (incs ?? []).filter((i) => inRange(i.onset_at, range))
  const open = issues.filter((i) => i.status !== 'closed')
  const hit = issues.reduce((a, i) => a + i.affected, 0)
  const rangeLabel = RANGES.find((r) => r.id === range)!.label
  const reset = () => { resetSetup(); setDone(0); setConfirmReset(false); setWelcome(true) }

  return (
    <Box display="flex" flexDirection="column" gap="spacing.9">
      <WelcomeTour open={welcome} onClose={() => setWelcome(false)} />
      <Modal isOpen={confirmReset} onDismiss={() => setConfirmReset(false)} size="small" accessibilityLabel="Reset setup">
        <ModalHeader title="Reset setup?" />
        <ModalBody>
          <Text>Setup goes back to 0 of {SETUP_STEPS} and the welcome tour opens again. Your payment issues and history stay as they are.</Text>
        </ModalBody>
        <ModalFooter>
          <Box display="flex" justifyContent="flex-end" gap="spacing.4">
            <Button variant="tertiary" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="primary" onClick={reset}>Reset setup</Button>
          </Box>
        </ModalFooter>
      </Modal>

      <Box display="flex" flexDirection="column" gap="spacing.6" testID="ray-home">
        <PageHeader title="Overview" description="What broke for your customers, who it hit and what has been made right."
          actions={
            <Box display="flex" flexWrap="wrap" alignItems="center" gap="spacing.4">
              <Button variant="tertiary" size="medium" onClick={() => setWelcome(true)}>Take a tour</Button>
              <Box height="spacing.6" display="flex"><Divider orientation="vertical" /></Box>
              <Button variant="tertiary" size="medium" onClick={() => setConfirmReset(true)}>Reset setup</Button>
              <MenuPick value={range} options={RANGES} onPick={pickRange} />
            </Box>
          } />

        {/* One line, with the Ray glyph inside the field. Ray's chat view (when a question is asked) uses the larger ChatInput. */}
        <Box display="flex" flexDirection="column" gap="spacing.3">
          <TextInput accessibilityLabel="Ask Ray" placeholder="Ask Ray anything about your payments" leadingIcon={RayIcon} value={value} onChange={({ value }) => setValue(value ?? '')} onKeyDown={({ key }) => { if (key === 'Enter') ask({ value }) }}
            trailingButton={<Link variant="button" size="large" onClick={() => ask({ value })}>Ask</Link>} />
          {/* Questions a merchant would ask. Each one runs as if typed. Not on a phone, where three stacked rows would push the data off the screen. */}
          <Box display={{ base: 'none', m: 'flex' }} flexWrap="wrap" gap="spacing.3">
            {QUESTIONS.map(([q, icon]) => <Button key={q} variant="secondary" size="small" icon={icon} onClick={() => ask({ value: q })}>{q}</Button>)}
          </Box>
        </Box>

        {done < SETUP_STEPS ? (
          <SetupCard done={done} onStart={() => nav('/setup')} />
        ) : (
          <Alert isFullWidth isDismissible={false} color="positive" title="Setup complete" description={`All ${SETUP_STEPS} steps are done.`} actions={{ primary: { text: 'Review', onClick: () => nav('/setup') } }} />
        )}

        {error && <Text color="feedback.text.negative.intense">Could not load payment issues: {error}. Reload the page to try again.</Text>}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', l: 'repeat(4, minmax(0, 1fr))' }} gap="spacing.5" testID="home-cards">
          <Stat label="Open payment issues" value={String(open.length)} hint={issues.length ? `of ${issues.length} that started ${rangeLabel.toLowerCase()}` : `none started ${rangeLabel.toLowerCase()}`} icon={AlertTriangleIcon} tone="notice" />
          <Stat label="Customers hit" value={String(hit)} hint={hit ? `${issues.reduce((a, i) => a + i.silent, 0)} never wrote in` : `none ${rangeLabel.toLowerCase()}`} icon={UsersIcon} />
          <Stat label="Money stuck" value={rupees(open.reduce((a, i) => a + i.at_risk_paise, 0))} hint="on open issues" icon={RupeesIcon} />
          <Stat label="Customers made whole" value={String(issues.reduce((a, i) => a + i.fixed, 0))} hint={hit ? `of ${hit} hit` : `none hit ${rangeLabel.toLowerCase()}`} icon={CheckCircleIcon} tone="positive" />
        </Box>

        {/* What needs attention is the wider column and comes first; the chart is the compact companion. One column below the large breakpoint. */}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'minmax(0, 3fr) minmax(0, 2fr)' }} gap="spacing.5" alignItems="start">
          <Panel title="Open payment issues, by money at stake" pad={false}>
            {open.length === 0 ? <Box padding="spacing.5"><Text size="small" color="surface.text.gray.muted">No open payment issues started {rangeLabel.toLowerCase()}. Blindspot checks every 15 minutes.</Text></Box> : (
              <Box testID="home-issues">
                {[...open].sort((a, b) => b.at_risk_paise - a.at_risk_paise).map((i, n, all) => (
                  <RouterLink key={i.id} to={`/incidents/${i.id}`} style={{ textDecoration: 'none' }}>
                    <Box padding="spacing.5" display="flex" flexDirection={{ base: 'column', m: 'row' }} alignItems={{ base: 'flex-start', m: 'center' }} justifyContent="space-between" gap="spacing.3" borderBottomWidth={n < all.length - 1 ? "thin" : "none"} borderBottomColor="surface.border.gray.subtle">
                      <Box display="flex" flexDirection="column">
                        <Text weight="semibold" color="interactive.text.primary.normal">{headline(i)}</Text>
                        <Text size="small" color="surface.text.gray.muted">{i.title}</Text>
                      </Box>
                      <Box display="flex" alignItems="center" gap="spacing.4" flexShrink={0}>
                        <Badge size="medium" color={OWNER_TONE[i.owner]}>{cause(i)}</Badge>
                        <Text weight="semibold">{rupees(i.at_risk_paise)}</Text>
                        <ChevronRightIcon size="medium" color="surface.icon.gray.muted" />
                      </Box>
                    </Box>
                  </RouterLink>
                ))}
              </Box>
            )}
          </Panel>
          <IssuesChart issues={issues} range={range} />
        </Box>
        <Text size="small" color="surface.text.gray.muted">Demo data. Ranges count back from 2 Oct 2026, the day this data was taken.</Text>
      </Box>

      <Box display="flex" flexDirection="column" gap="spacing.5">
        <Heading as="h2" size="large">Explore Blindspot</Heading>
        {/* Nine cards in the side menu's order, each opening its page (its guide is one click away there, under "How it works").
            Three across from l, so the nine fill three rows; two across at m, where the first takes a whole row so none is left alone. */}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
          {EXPLORE.map((id) => GUIDES.find((g) => g.id === id)!).map((g, i) => (
            <Box key={g.id} gridColumn={i === 0 ? { base: 'auto', m: '1 / -1', l: 'auto' } : 'auto'}>
              <RouterLink to={g.to} style={{ textDecoration: 'none' }}>
                <Card height="100%">
                  <CardBody>
                    <Box display="flex" flexDirection="column" gap="spacing.3" height="100%">
                      <Box display="flex" alignItems="center" gap="spacing.3"><g.icon size="medium" color="surface.icon.gray.muted" /><Text color="surface.text.gray.muted">{g.title}</Text></Box>
                      <Heading as="h3" size="small">{g.tagline}</Heading>
                      {/* The page in one line. Not on phones, where seven cards are already a long scroll. */}
                      <Box display={{ base: 'none', m: 'block' }}><Text size="small" color="surface.text.gray.muted" truncateAfterLines={3}>{g.summary ?? `${g.description.split('. ')[0].replace(/\.$/, '')}.`}</Text></Box>
                      {/* A grey footer band with a grey chevron, as on Agent Studio's cards: the whole card is the link, so the footer is not blue. */}
                      <Box marginTop="auto" backgroundColor="surface.background.gray.subtle" borderRadius="medium" paddingX="spacing.4" paddingY="spacing.3" display="flex" justifyContent="space-between" alignItems="center">
                        <Text size="small" weight="semibold" color="surface.text.gray.muted">{`Open ${g.title}`}</Text><ChevronRightIcon size="medium" color="surface.icon.gray.muted" />
                      </Box>
                    </Box>
                  </CardBody>
                </Card>
              </RouterLink>
            </Box>
          ))}
        </Box>
      </Box>

      <Ray />
    </Box>
  )
}
