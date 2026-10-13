import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, ChevronRightIcon, EmptyState, Heading, HistoryIcon, Link, Modal, ModalBody, ModalFooter, ModalHeader, RayIcon, RupeesIcon, Text, TextInput, UsersIcon } from '@razorpay/blade/components'
import { ActivityIcon, BellIcon, ClipboardIcon, CodeSnippetIcon, RadioIcon, SettingsIcon, type IconComponent } from '@razorpay/blade/components'
import { IssuesChart } from '../components/IssuesChart'
import { MenuPick } from '../components/MenuPick'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { SetupCard } from '../components/SetupCard'
import { Stat } from '../components/Stat'
import { UnpaidRenewalsRow } from '../components/UnpaidRenewalsRow'
import { RayHistory } from '../components/RayHistory'
import { WelcomeTour } from '../components/WelcomeTour'
import { useAccount } from '../lib/account'
import { get, rupees, useGet, type Schemas } from '../lib/api'
import { cause, headline } from '../lib/format'
import { GUIDES } from '../lib/guides'
import { addTurn, route } from '../lib/rayChats'
import { inRange, parseRange, RANGES, type RangeId } from '../lib/range'
import { markWelcomed, resetSetup, setupDone, SETUP_STEPS, welcomeDue } from '../lib/setup'
import Ray from './Ray'

// One short line for each page, in the product's words (docs/PRD_V3.md). Eight words or fewer.
const EXPLORE_LINE: Record<string, string> = {
  incidents: 'Every customer a problem hit, and what it cost',
  conversations: 'What customers wrote, and the replies sent',
  access: 'Money owed by customers who kept access',
  integration: 'Connect your webhook and check it works',
  channels: 'Choose where customers can reach you',
  autonomy: 'Decide how much Blindspot does on its own',
  learning: 'Tell Blindspot which alerts were false',
  how: 'See how often Blindspot gets it right',
  scan: 'Who paid and got nothing in the last 30 days',
}
const EXPLORE = ['incidents', 'conversations', 'access', 'integration', 'channels', 'autonomy', 'learning', 'how', 'scan']
// The brand account's pages, in its menu's order, with the menu's icons and a line of its own (eight words or fewer). Six cards: two rows of three (l), three rows of two (m).
// Accuracy is the small merchant's page for now, so it is not here.
const EXPLORE_BRAND: { title: string; to: string; icon: IconComponent; line: string }[] = [
  { title: 'Payment issues', to: '/incidents', icon: ActivityIcon, line: 'Every customer a problem hit, and what it cost' },
  { title: 'Alerts', to: '/alerts', icon: BellIcon, line: 'What your alert tools sent, and what happened' },
  { title: 'Integration', to: '/connect', icon: CodeSnippetIcon, line: 'Your alert door and shared Slack channel' },
  { title: 'Connectors', to: '/channels', icon: RadioIcon, line: "Alert tools, Slack and Razorpay's own monitor" },
  { title: 'Settings', to: '/settings', icon: SettingsIcon, line: 'What waits for approval, and who approves' },
  { title: 'Audit trail', to: '/audit', icon: ClipboardIcon, line: 'Every alert, root cause and approval, newest first' },
]
// Orange when the fix is yours, neutral when it is someone else's (the same as the Payment issues page).
const OWNER_TONE = { merchant_code: 'notice', merchant_config: 'notice', razorpay: 'neutral', bank: 'neutral', customer: 'neutral', unknown: 'neutral' } as const

// The Blindspot overview, laid out like the dashboard's own home and in the order a merchant asks: Ray one tap away; the setup card, only until setup is done
// (it is the one thing to do first); what is wrong and how bad (four cards); what to act on (the open payment issues, biggest first) beside the trend (the chart);
// then the pages and what Ray sends. Every figure is added up in the browser from the issue summaries the API returns.
export default function Home() {
  const nav = useNavigate()
  // The brand account hears from its alert tools and works in Slack: no Ray bar, no customer channels to set up, no WhatsApp heads-up. Its account manager set it up.
  const brand = useAccount().kind === 'enterprise'
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
  const [welcome, setWelcome] = useState(() => !brand && welcomeDue())
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(markWelcomed, [])
  // The range lives in the address (?range=7d), so a reload or a shared link keeps it.
  const [params, setParams] = useSearchParams()
  const range = parseRange(params.get('range'))
  const pickRange = (id: RangeId) => setParams((p) => { p.set('range', id); return p }, { replace: true })
  const { data: incs, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  // Still waiting, per issue, from the same counts as its own page ("still to put right"), so this card agrees with every issue page and moves when a fix runs. The engine's
  // stored `fixed` also counts customers who paid again on their own, so it is not used for Kaksha. The brand's list already counts only what was put right.
  const [waiting, setWaiting] = useState<Record<string, number>>()
  const ids = brand ? '' : (incs ?? []).map((i) => i.id).join(',')
  useEffect(() => {
    if (!ids) return
    let live = true
    Promise.all(ids.split(',').map((id) => get<Schemas['IncidentDetail']>(`/api/incidents/${id}`).then((d) => [id, (d.tier_counts.exact ?? 0) + (d.tier_counts.likely ?? 0) + (d.tier_counts.check ?? 0)] as const)))
      .then((rows) => live && setWaiting(Object.fromEntries(rows)), () => live && setWaiting({}))
    return () => { live = false }
  }, [ids])
  if ((!incs && !error) || (ids && !waiting)) return <PageSkeleton />
  const stillWaiting = (i: Schemas['IncidentSummary']) => waiting?.[i.id] ?? i.affected - i.fixed

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
        <PageHeader title="Overview" description={<>Blindspot finds everyone a payment problem hit, says whose side it is, and wins them back. <Link href="/how-it-works" onClick={(e) => { e.preventDefault(); nav('/how-it-works') }}>How Blindspot works</Link></>}
          actions={
            <Box display="flex" flexWrap="wrap" alignItems="center" gap="spacing.4">
              {!brand && <Button variant="tertiary" size="medium" onClick={() => setWelcome(true)}>Take a tour</Button>}
              {!brand && <Button variant="tertiary" size="medium" onClick={() => setConfirmReset(true)}>Reset setup</Button>}
              <MenuPick value={range} options={RANGES} onPick={pickRange} />
            </Box>
          } />

        {/* Ray is one tap away and takes one line: the field with the Ray glyph inside it, and History at its end. The three starter questions live on Ray's own
            page, where they can be tapped without being a second row of buttons above the data. */}
        {brand ? (
          <Alert isFullWidth isDismissible={false} color="neutral" title="Answers reach your team in Slack"
            description="Root causes, signed off by Razorpay support, land in your shared channel #razorpay-payments, with the actions that need your approval." />
        ) : (
        <Box display="flex" alignItems="center" gap="spacing.4">
          <Box flexGrow="1" minWidth="spacing.0">
            <TextInput accessibilityLabel="Ask Ray" placeholder="Ask Ray anything about your payments" leadingIcon={RayIcon} value={value} onChange={({ value }) => setValue(value ?? '')} onKeyDown={({ key }) => { if (key === 'Enter') ask({ value }) }}
              trailingButton={<Link variant="button" size="large" onClick={() => ask({ value })}>Ask</Link>} />
          </Box>
          <Button variant="secondary" size="medium" icon={HistoryIcon} onClick={() => setHistory(true)}>History</Button>
        </Box>
        )}

        {brand ? null : done < SETUP_STEPS ? (
          <SetupCard done={done} onStart={() => nav('/setup')} />
        ) : (
          <Alert isFullWidth isDismissible={false} color="positive" title="Setup complete" description={`All ${SETUP_STEPS} steps are done.`} actions={{ primary: { text: 'Review', onClick: () => nav('/setup') } }} />
        )}

        {error && <Text color="feedback.text.negative.intense">Could not load payment issues: {error}. Reload the page to try again.</Text>}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', l: 'repeat(4, minmax(0, 1fr))' }} gap="spacing.5" testID="home-cards">
          <Stat label="Open payment issues" value={String(open.length)} hint={issues.length ? `of ${issues.length} that started ${rangeLabel.toLowerCase()}` : `none started ${rangeLabel.toLowerCase()}`} icon={AlertTriangleIcon} tone="notice" />
          <Stat label="Customers hit" value={hit.toLocaleString('en-IN')} hint={!hit ? `none ${rangeLabel.toLowerCase()}` : brand ? `across ${issues.length} payment issues` : `${issues.reduce((a, i) => a + i.silent, 0)} never wrote in`} icon={UsersIcon} />
          <Stat label="Money stuck" value={rupees(open.reduce((a, i) => a + i.at_risk_paise, 0))} hint="on open issues" icon={RupeesIcon} />
          {/* The engine's `fixed` counts every customer who no longer needs anything, including those who paid again on their own, so the card says that and claims no credit (PRD v3: never count a customer who came back on their own as won back). */}
          <Stat label="No longer waiting" value={issues.reduce((a, i) => a + i.affected - stillWaiting(i), 0).toLocaleString('en-IN')} hint={hit ? `of ${hit.toLocaleString('en-IN')} hit, put right or sorted on their own` : `none hit ${rangeLabel.toLowerCase()}`} icon={CheckCircleIcon} tone="positive" />
        </Box>
        {/* Kaksha's unpaid renewals: a balance it is owed, not a payment issue, so a row of its own under the four cards (DESIGN.md section 16). Not tied to the range. */}
        {!brand && <UnpaidRenewalsRow />}

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
                    <Box paddingX="spacing.5" paddingY="spacing.4" display="flex" alignItems="center" justifyContent="space-between" gap="spacing.4" borderBottomWidth={n < all.length - 1 ? 'thin' : 'none'} borderBottomColor="surface.border.gray.subtle">
                      <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
                        <Text weight="semibold" color="interactive.text.primary.normal">{headline(i)}</Text>
                        <Text size="small" color="surface.text.gray.muted" truncateAfterLines={1}>{i.title}</Text>
                      </Box>
                      {/* The amount over its owner, so the headline keeps the width. */}
                      <Box display="flex" alignItems="center" gap="spacing.3" flexShrink={0}>
                        <Box display="flex" flexDirection="column" alignItems="flex-end" gap="spacing.1">
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
            Three across from l, so the nine fill three rows; two across at m, where the first takes a whole row so none is left alone.
            Every row is as tall as the tallest, so a line that wraps on one machine's font does not make one card taller than the rest. */}
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', l: 'repeat(3, minmax(0, 1fr))' }} gridAutoRows="1fr" gap="spacing.5">
          {(brand ? EXPLORE_BRAND : EXPLORE.map((id) => GUIDES.find((g) => g.id === id)!).map((g) => ({ ...g, line: EXPLORE_LINE[g.id] }))).map((g, i) => (
            <Box key={g.to} gridColumn={i === 0 && !brand ? { base: 'auto', m: '1 / -1', l: 'auto' } : 'auto'}>
              <RouterLink to={g.to} style={{ textDecoration: 'none' }}>
                <Card height="100%">
                  <CardBody>
                    {/* A name and one line. The whole card is the link, so it has a chevron and no button. The guide pages keep the long text. */}
                    <Box display="flex" flexDirection="column" gap="spacing.2" height="100%">
                      <Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing.3">
                        <Box display="flex" alignItems="center" gap="spacing.3"><g.icon size="medium" color="surface.icon.gray.muted" /><Text weight="semibold">{g.title}</Text></Box>
                        <ChevronRightIcon size="medium" color="surface.icon.gray.muted" />
                      </Box>
                      <Text size="small" color="surface.text.gray.muted">{g.line}</Text>
                    </Box>
                  </CardBody>
                </Card>
              </RouterLink>
            </Box>
          ))}
        </Box>
      </Box>

      {!brand && <Ray />}
    </Box>
  )
}
