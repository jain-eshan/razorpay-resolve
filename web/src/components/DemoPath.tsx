import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, ArrowLeftIcon, ArrowRightIcon, Badge, Box, Button, Card, CardBody, Text } from '@razorpay/blade/components'
import { BRAND, startAgain } from '../lib/brand'
import { PageSkeleton } from './PageSkeleton'

// The big-brand demo is one path for the video (roadmap J8): the store breaks, the monitoring tool alerts, the RCA lands in Slack, the issue page shows the proof. Each screen
// carries this bar: where you are, one line on what to look at (the screen passes it, built from the data), and Back and Next.
const PATH = [
  { to: '/demo/store', name: 'Store' },
  { to: '/demo/alert', name: 'Alert' },
  { to: '/demo/slack', name: 'Slack' },
  { to: '/demo/incident', name: 'Issue page' },
] as const

// `primary`: whether Next is the one blue button of the screen. A screen with a button of its own (Pay in the store) keeps Next secondary until that is done.
export function DemoPath({ at, guide, primary = true }: { at: 0 | 1 | 2 | 3; guide: string; primary?: boolean }) {
  const nav = useNavigate()
  const last = at === PATH.length - 1
  return (
    <Card testID="demo-path">
      <CardBody>
        <Box display="flex" flexDirection={{ base: 'column', l: 'row' }} justifyContent="space-between" alignItems={{ base: 'stretch', l: 'center' }} gap="spacing.4">
          <Box display="flex" flexDirection="column" gap="spacing.2" minWidth="0px">
            <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap">
              <Badge color="information" size="medium">Big-brand demo</Badge>
              <Text weight="semibold">{`Step ${at + 1} of ${PATH.length}: ${PATH[at].name}`}</Text>
            </Box>
            <Text size="small" color="surface.text.gray.muted">{guide}</Text>
          </Box>
          <Box display="flex" flexWrap="wrap" alignItems="center" gap="spacing.3" flexShrink={0}>
            {!last && <Button variant="tertiary" size="medium" onClick={() => nav('/incidents')}>Leave the demo</Button>}
            <Button variant="tertiary" size="medium" onClick={() => { startAgain(); nav(PATH[0].to) }}>Start again</Button>
            {at > 0 && <Button variant="secondary" size="medium" icon={ArrowLeftIcon} onClick={() => nav(PATH[at - 1].to)}>Back</Button>}
            <Button variant={primary ? 'primary' : 'secondary'} size="medium" icon={ArrowRightIcon} iconPosition="right" onClick={() => nav(last ? '/demo/issues' : PATH[at + 1].to)}>
              {last ? 'See all issues' : `Next: ${PATH[at + 1].name}`}
            </Button>
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}

// A page of the demo that sits outside the Razorpay dashboard (the store, the monitoring alert, the Slack channel): its own surface and the demo label, then the path bar.
export function DemoFrame({ at, guide, primary, children }: { at: 0 | 1 | 2; guide: string; primary?: boolean; children: ReactNode }) {
  return (
    <Box backgroundColor="surface.background.gray.moderate" minHeight="100vh">
      <Alert color="neutral" isFullWidth isDismissible={false} description={`Demo data. ${BRAND}, its customers and every payment here are made up. This is not the real ${BRAND}, Sentry or Slack.`} />
      <main>
        <Box testID="page" maxWidth="1120px" marginX="auto" padding={{ base: 'spacing.5', m: 'spacing.7' }} paddingBottom="spacing.11" display="flex" flexDirection="column" gap="spacing.6">
          <DemoPath at={at} guide={guide} primary={primary} />
          {children}
        </Box>
      </main>
    </Box>
  )
}

// While the demo's data loads, or when it cannot: the same frame, so the path bar is there and the page does not jump, and an error that says what to do.
export function DemoLoading({ at, error }: { at: 0 | 1 | 2; error?: string }) {
  return (
    <DemoFrame at={at} guide="Loading the demo data">
      {error
        ? <Alert isFullWidth color="negative" isDismissible={false} title="The demo data did not load" description={`${error}. Reload the page. If it keeps failing, run "uv run python -m synth.j2_brand" and reload.`} />
        : <PageSkeleton />}
    </DemoFrame>
  )
}
