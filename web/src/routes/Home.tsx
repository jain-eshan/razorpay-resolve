import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, ChevronRightIcon, EmptyState, Heading, HistoryIcon, Link, Modal, ModalBody, ModalFooter, ModalHeader, RayIcon, RupeesIcon, Text, TextInput, UsersIcon } from '@razorpay/blade/components'
import { IssuesChart } from '../components/IssuesChart'
import { MenuPick } from '../components/MenuPick'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { SetupCard } from '../components/SetupCard'
import { Stat } from '../components/Stat'
import { RayHistory } from '../components/RayHistory'
import { WelcomeTour } from '../components/WelcomeTour'
import { rupees, useGet, type Schemas } from '../lib/api'
import { cause, headline } from '../lib/format'
import { GUIDES } from '../lib/guides'
import { addTurn, route } from '../lib/rayChats'
import { inRange, parseRange, RANGES, type RangeId } from '../lib/range'
import { markWelcomed, resetSetup, setupDone, SETUP_STEPS, welcomeDue } from '../lib/setup'
import Ray from './Ray'

const EXPLORE = ['incidents', 'conversations', 'access', 'integration', 'channels', 'autonomy', 'learning', 'how', 'scan']
// Orange when the fix is yours, neutral when it is someone else's (the same as the Payment issues page).
const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'neutral', bank: 'neutral', customer: 'neutral', unknown: 'neutral' } as const

// The Blindspot overview, laid out like the dashboard's own home and in the order a merchant asks: Ray one tap away; the setup card, only until setup is done
// (it is the one thing to do first); what is wrong and how bad (four cards); what to act on (the open payment issues, biggest first) beside the trend (the chart);
// then the pages and what Ray sends. Every figure is added up in the browser from the issue summaries the API returns.
export default function Home() {
  const nav = useNavigate()
  const [value, setValue] = useState('')
  // A question opens Ray's chat page (routes/RayChat.tsx), where it is kept in the history. A question about a screen goes to that screen.
  const ask = ({ value }: { value: string }) => {
    const q = value.trim()
    if (!q) return
    const r = route(q)
    nav(r.to ?? `/ray/${addTurn(undefined, q, r.kind)}`)
  }
  const [history, setHistory] = useState(false)
  const [done, setDone] = useState(setupDone)
  const [welcome, setWelcome] = useState(welcomeDue)
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(markWelcomed, [])
  // The range lives in the address (?range=7d), so a reload or a shared link keeps it.
  const [params, setParams] = useSearchParams()
  const range = parseRange(params.get('range'))
  const pickRange = (id: RangeId) => setParams((p) => { p.set('range', id); return p }, { replace: true })
  const { data: incs, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  if (!incs && !error) return <PageSkeleton />

  const issues = (incs ?? []).filter((i) => inRange(i.onset_at, range))
  const open = issues.filter((i) => i.status !== 'closed')
  const hit = issues.reduce((a, i) => a + i.affected, 0)
  const rangeLabel = RANGES.find((r) => r.id === range)!.label
  const reset = () => { resetSetup(); setDone(0); setConfirmReset(false); setWelcome(true) }

  return (
    <Box display="flex" flexDirection="column" gap="spacing.9">
      <WelcomeTour open={welcome} onClose={() => setWelcome(false)} />
      <RayHistory isOpen={history} onClose={() => setHistory(false)} />
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
              <Button variant="tertiary" size="medium" onClick={() => setConfirmReset(true)}>Reset setup</Button>
              <MenuPick value={range} options={RANGES} onPick={pickRange} />
            </Box>
          } />

        {/* Ray is one tap away and takes one line: the field with the Ray glyph inside it, and History at its end. The three starter questions live on Ray's own
            page, where they can be tapped without being a second row of buttons above the data. */}
        <Box display="flex" alignItems="center" gap="spacing.4">
          <Box flexGrow="1" minWidth="spacing.0">
            <TextInput accessibilityLabel="Ask Ray" placeholder="Ask Ray anything about your payments" leadingIcon={RayIcon} value={value} onChange={({ value }) => setValue(value ?? '')} onKeyDown={({ key }) => { if (key === 'Enter') ask({ value }) }}
              trailingButton={<Link variant="button" size="large" onClick={() => ask({ value })}>Ask</Link>} />
          </Box>
          <Button variant="secondary" size="medium" icon={HistoryIcon} onClick={() => setHistory(true)}>History</Button>
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

        {/* What needs attention comes first and the trend sits beside it, half and half. One column below the large breakpoint. */}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(2, minmax(0, 1fr))' }} gap="spacing.5" alignItems="stretch" testID="home-grid">
          {/* From l the list card is laid over the row without adding to it (absolute inside a relative cell): the chart card alone sets the row's height, so the row never
              resizes with the number of issues, and a long list scrolls inside its card. Stacked on a smaller screen it is an ordinary card. */}
          <Box position={{ base: 'static', l: 'relative' }}>
          <Box position={{ base: 'static', l: 'absolute' }} top="spacing.0" bottom="spacing.0" left="spacing.0" right="spacing.0">
          <Panel title="Open payment issues, by money at stake" pad={false} fill>
            {open.length === 0 ? (
              <Box flexGrow="1" minHeight={{ base: '300px', l: 'spacing.0' }} display="flex" alignItems="center" justifyContent="center" padding="spacing.5">
                <EmptyState size="small" asset={<CheckCircleIcon size="2xlarge" color="feedback.icon.positive.intense" />} title="No open payment issues" description={`None started ${rangeLabel.toLowerCase()}. Blindspot checks every 15 minutes.`} />
              </Box>
            ) : (
              <Box testID="home-issues" flexGrow="1" minHeight="spacing.0" overflow="auto">
                {[...open].sort((a, b) => b.at_risk_paise - a.at_risk_paise).map((i, n, all) => (
                  <RouterLink key={i.id} to={`/incidents/${i.id}`} style={{ textDecoration: 'none' }}>
                    <Box padding="spacing.5" display="flex" alignItems="center" justifyContent="space-between" gap="spacing.4" borderBottomWidth={n < all.length - 1 ? 'thin' : 'none'} borderBottomColor="surface.border.gray.subtle">
                      <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
                        <Text weight="semibold" color="interactive.text.primary.normal">{headline(i)}</Text>
                        <Text size="small" color="surface.text.gray.muted" truncateAfterLines={2}>{i.title}</Text>
                      </Box>
                      {/* The amount over its owner, so the headline keeps the width. */}
                      <Box display="flex" alignItems="center" gap="spacing.3" flexShrink={0}>
                        <Box display="flex" flexDirection="column" alignItems="flex-end" gap="spacing.2">
                          <Text weight="semibold">{rupees(i.at_risk_paise)}</Text>
                          <Badge size="small" color={OWNER_TONE[i.owner]}>{cause(i)}</Badge>
                        </Box>
                        <ChevronRightIcon size="medium" color="surface.icon.gray.muted" />
                      </Box>
                    </Box>
                  </RouterLink>
                ))}
              </Box>
            )}
            {/* Always at the foot of the card, so it is the same card whether it holds five issues or none. */}
            <Box marginTop="auto" padding="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle" display="flex" justifyContent="flex-end">
              <Button variant="tertiary" size="small" iconPosition="right" icon={ChevronRightIcon} onClick={() => nav('/incidents')}>See all payment issues</Button>
            </Box>
          </Panel>
          </Box>
          </Box>
          <IssuesChart key={range === 'today' ? '7d' : range} issues={incs ?? []} range={range} />
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
