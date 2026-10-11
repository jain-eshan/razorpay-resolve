import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowRightIcon, Badge, BladeProvider, Box, Button, Card, CardBody, CheckIcon, Collapsible, CollapsibleBody, CollapsibleLink, Heading, ProgressBar, RayIcon, RefreshIcon, Text } from '@razorpay/blade/components'
import { bladeTheme } from '@razorpay/blade/tokens'
import { Accent } from '../components/Accent'
import { useCountUp } from '../lib/useCountUp'
import { Label } from '../components/AgentAnswer'
import { PageHeader } from '../components/PageHeader'
import { HERO } from '../lib/art'
import { useHeroWash } from '../components/iso'
import { rupees, useGet, type Schemas } from '../lib/api'
import { cause, headline } from '../lib/format'
import { prefersReducedMotion } from '../razorsense'
import { PageSkeleton } from '../components/PageSkeleton'

type Scan = Schemas['ScanResult']
const STEP_MS = 520

// What Ray did, as short lines in the order it did them. A count is shown only where the scan result holds one; nothing is typed in.
const steps = (d: Scan): [string, string][] => [
  ["Reading your payments from Razorpay's records", `${d.days} days`],
  ['Reading your access records', ''],
  ["Matching each payment to a customer's access", ''],
  ['Looking for what broke: webhooks, pay pages, renewals', ''],
  ['Grouping what I found into payment issues', `${d.incidents.length} issues`],
  ['Counting who is still locked out', `${d.leaked_customers} customers`],
]

// Day 0: the first thing a merchant sees on connecting. It finds money that is already stuck. Every visit plays the scan as a checklist, like Razorpay Ads'
// "Check your AI visibility", so anyone testing the demo sees how it works each time. The result is saved, so this is a replay, and it says so.
export default function Scan() {
  const { data, error } = useGet<Scan>('/api/scan/day0')
  const [step, setStep] = useState(prefersReducedMotion ? 99 : 0)
  useEffect(() => {
    if (!data || step >= steps(data).length) return
    const t = setTimeout(() => setStep((n) => n + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [data, step])

  if (error) return <Text color="feedback.text.negative.intense">Could not load the first check: {error}. Reload the page to try again.</Text>
  if (!data) return <PageSkeleton />
  const running = step < steps(data).length
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="First check" description="What was already broken on the day you connected, from the last 30 days of payments. Nothing changes until you approve it." guide="scan"
        actions={!running && <Button variant="tertiary" size="medium" icon={RefreshIcon} onClick={() => setStep(0)}>Run it again</Button>} />
      {running ? <Running data={data} step={step} /> : <Report data={data} />}
    </Box>
  )
}

function Hero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  const wash = useHeroWash()
  return (
    <Box position="relative" overflow="hidden" borderRadius="large" testID="scan-hero">
      <div style={{ position: 'absolute', inset: 0, background: wash }} />
      <Box position="relative" display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'minmax(0, 3fr) minmax(0, 2fr)' }} alignItems="center" gap="spacing.5" padding={{ base: 'spacing.6', m: 'spacing.8' }}>
        <Box display="flex" flexDirection="column" alignItems="flex-start" gap="spacing.5">
          <Box display="flex" alignItems="center" gap="spacing.3"><RayIcon size="medium" color="surface.icon.onSea.onSubtle" /><Label>{eyebrow}</Label></Box>
          <Heading as="h2" size="2xlarge" weight="regular">{title}</Heading>
          {children}
        </Box>
        <Box display={{ base: 'none', xl: 'block' }}><img src={HERO.scan.src} alt={HERO.scan.alt} style={{ display: 'block', width: '100%', height: 'auto' }} /></Box>
      </Box>
    </Box>
  )
}

function Running({ data, step }: { data: Scan; step: number }) {
  const list = steps(data)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6" testID="scan-running">
      <Hero eyebrow="Checking the last 30 days" title={<>Checking who paid and <Accent>never got in</Accent></>}>
        <Text color="surface.text.gray.subtle">Ray is reading Razorpay's records and yours side by side. Nothing is changed.</Text>
      </Hero>
      <Card>
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.5">
            <ProgressBar label="Progress" showPercentage={false} value={Math.round((Math.min(step, list.length) / list.length) * 100)} />
            <Box display="flex" flexDirection="column" gap="spacing.4">
              {list.map(([line, count], i) => {
                const done = i < step
                const active = i === step
                return (
                  <Box key={line} display="flex" alignItems="center" gap="spacing.4" opacity={done || active ? 1 : 0.5}>
                    <Box width="24px" height="24px" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center"
                      backgroundColor={done ? 'feedback.background.positive.subtle' : 'surface.background.gray.moderate'}>
                      {done ? <CheckIcon size="small" color="feedback.icon.positive.intense" /> : active
                        ? <m.div animate={{ rotate: 90 }} transition={{ duration: 0.48, ease: [0.5, 0, 0, 1], repeat: Infinity, repeatDelay: 0.48 }} style={{ display: 'flex' }}><RayIcon size="small" color="surface.icon.onSea.onSubtle" /></m.div>
                        : <Text size="xsmall" color="surface.text.gray.muted">{i + 1}</Text>}
                    </Box>
                    <Box flex="1" minWidth="0px"><Text color={active ? 'surface.text.gray.normal' : 'surface.text.gray.subtle'} weight={active ? 'semibold' : 'regular'}>{line}</Text></Box>
                    {done && count && (
                      <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}><Text size="small" color="surface.text.gray.muted">{count}</Text></m.div>
                    )}
                  </Box>
                )
              })}
            </Box>
            <Text size="small" color="surface.text.gray.muted">A replay of your saved first check. Every number comes from your data.</Text>
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return <Box display="flex" flexDirection="column" gap="spacing.1"><Heading size="2xlarge">{value}</Heading><Label>{label}</Label></Box>
}

function Report({ data }: { data: Scan }) {
  const nav = useNavigate()
  const people = useCountUp(data.leaked_customers)
  const sorted = [...data.incidents].sort((a, b) => b.affected - a.affected)
  const top = sorted[0]
  const fine = data.leaked_customers === 0
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6" testID="scan-report">
      <Hero eyebrow="First check · last 30 days" title={fine ? <>Nobody paid and <Accent>missed out</Accent></> : <>{people} customers paid and <Accent>have no access</Accent></>}>
        <Box display="flex" flexWrap="wrap" alignItems="center" gap={{ base: 'spacing.6', m: 'spacing.9' }}>
          <Figure label="Paid by them, no access given" value={rupees(data.leaked_paise)} />
          <Figure label="Payment issues found in total" value={String(data.incidents.length)} />
          <Badge size="large" color={fine ? 'positive' : 'negative'}>{fine ? 'All clear' : 'Needs urgent attention'}</Badge>
        </Box>
        <Text color="surface.text.gray.subtle">{data.headline} Checked against Razorpay's records and your access records. Nothing has been changed.</Text>
      </Hero>

      {sorted.length > 0 && (
        <Box display="flex" flexDirection="column" gap="spacing.5">
          <Box display="flex" flexDirection="column" gap="spacing.1"><Heading as="h2" size="medium">What to do next</Heading><Text size="small" color="surface.text.gray.muted">Biggest first, by customers affected.</Text></Box>
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
            {sorted.map((i, k) => (
              // The biggest takes two columns from l, so five cards fill two rows with no gap.
              <Box key={i.id} gridColumn={k === 0 ? { base: 'auto', l: 'span 2' } : 'auto'}><Card height="100%">
                <CardBody>
                  <Box display="flex" flexDirection="column" gap="spacing.4" height="100%">
                    <Box display="flex" alignItems="center" gap="spacing.3">
                      <Box width="24px" height="24px" borderRadius="max" backgroundColor="surface.background.gray.moderate" display="flex" alignItems="center" justifyContent="center"><Text size="small" weight="semibold">{k + 1}</Text></Box>
                      <Text size="small" color="surface.text.gray.muted">{i.id}</Text>
                    </Box>
                    <Box display="flex" flexDirection="column" gap="spacing.1"><Heading as="h3" size="small">{headline(i)}</Heading><Text size="small" color="surface.text.gray.muted">{i.title}</Text></Box>
                    <Box display="flex" flexDirection="column" gap="spacing.1">
                      <Text size="small"><Text as="span" size="small" weight="semibold">Amount: </Text>{rupees(i.at_risk_paise)}</Text>
                      <Text size="small"><Text as="span" size="small" weight="semibold">Cause: </Text>{cause(i)}</Text>
                    </Box>
                    <Box marginTop="auto" paddingTop="spacing.3"><Button variant={k === 0 && fine ? 'primary' : 'secondary'} size="medium" iconPosition="right" icon={ArrowRightIcon} onClick={() => nav(`/incidents/${i.id}`)}>See who was hit</Button></Box>
                  </Box>
                </CardBody>
              </Card></Box>
            ))}
          </Box>
        </Box>
      )}

      {top && !fine && (
        <BladeProvider themeTokens={bladeTheme} colorScheme="dark">
          <Box borderRadius="large" backgroundColor="surface.background.gray.intense" padding={{ base: 'spacing.6', m: 'spacing.8' }} display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', m: 'center' }} gap="spacing.5" testID="scan-cta">
            <Box display="flex" flexDirection="column" gap="spacing.2" maxWidth="640px">
              <Box display="flex" alignItems="center" gap="spacing.3"><RayIcon size="medium" color="surface.icon.onSea.onSubtle" /><Text size="small" weight="semibold" color="surface.text.gray.muted">START WITH THE BIGGEST</Text></Box>
              <Heading as="h2" size="large">{`${headline(top)} · ${rupees(top.at_risk_paise)}`}</Heading>
              <Text color="surface.text.gray.subtle">I will show you who is affected and plan the fix. You approve every step.</Text>
            </Box>
            <Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => nav(`/incidents/${top.id}`)}>Start the fix</Button>
          </Box>
        </BladeProvider>
      )}

      <Collapsible>
        <CollapsibleLink>How the first check works</CollapsibleLink>
        <CollapsibleBody>
          <Box display="flex" flexDirection="column" gap="spacing.3" maxWidth="720px" testID="scan-how">
            <Text>I read your payments and webhook deliveries from Razorpay for the last {data.days} days, and your own access records.</Text>
            <Text>For every payment I check whether the customer got access. Payments that did not are grouped by what broke, and each group is one payment issue.</Text>
            <Text>The first check only reads. Nothing is granted, sent or changed until you approve it.</Text>
          </Box>
        </CollapsibleBody>
      </Collapsible>
    </Box>
  )
}
