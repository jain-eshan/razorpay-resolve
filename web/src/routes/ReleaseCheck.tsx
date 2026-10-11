import { useState } from 'react'
import { Alert, Badge, Box, Button, Code, Text, CheckCircleIcon, ClockIcon, MinusCircleIcon, RefreshIcon, ShieldIcon, XCircleIcon } from '@razorpay/blade/components'
import { PageHeader } from '../components/PageHeader'
import { IntegrationSteps } from '../components/IntegrationSteps'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'

type Step = Schemas['ReleaseStep']

const BADGE = { pass: ['Passed', 'positive'], fail: ['Failed', 'negative'], skipped: ['Not tried', 'neutral'] } as const

function StepRow({ step }: { step: Step }) {
  const Icon = step.status === 'pass' ? CheckCircleIcon : step.status === 'fail' ? XCircleIcon : MinusCircleIcon
  const tone = step.status === 'pass' ? 'feedback.icon.positive.intense' : step.status === 'fail' ? 'feedback.icon.negative.intense' : 'surface.icon.gray.muted'
  const [label, color] = BADGE[step.status]
  return (
    <Box display="flex" gap="spacing.4" alignItems="flex-start">
      <Box flexShrink={0} display="flex" paddingTop="spacing.1"><Icon size="medium" color={tone} /></Box>
      <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="spacing.0" maxWidth="720px">
        <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap"><Text weight="semibold">{step.label}</Text><Badge size="small" color={color}>{label}</Badge></Box>
        <Text size="small" color="surface.text.gray.muted">{step.saw}</Text>
        {step.meaning && <Text size="small">{step.meaning}</Text>}
        {step.next_step && <Text size="small" weight="semibold">Next: {step.next_step}</Text>}
      </Box>
    </Box>
  )
}

// Guard's release check (F-81 test ping, F-82 pre-deploy check). Read only: it sends your webhook one signed test event and opens your pay page.
export default function ReleaseCheck() {
  const [version, setVersion] = useState(0)
  const { data, error, busy } = useGet<Schemas['ReleaseCheck']>('/api/guard/release-check', version)
  if (!data && !error) return <PageSkeleton />
  const webhook = data?.steps.filter((s) => s.group === 'webhook') ?? []
  const page = data?.steps.filter((s) => s.group === 'pay_page') ?? []
  const passed = data?.steps.filter((s) => s.status === 'pass').length ?? 0
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader guide="integration" title="Integration" description="Run the go-live check before every release. It sends your webhook a signed test payment and opens your pay page, so a break shows up before a customer finds it."
        actions={<Button variant="secondary" icon={RefreshIcon} isLoading={busy} isDisabled={busy} onClick={() => setVersion((v) => v + 1)}>Run the check again</Button>} />
      <IntegrationSteps />
      {error && <Text color="feedback.text.negative.intense">Could not run the check: {error}. Reload the page, and if it keeps failing check that the API is running.</Text>}
      {data && (
        <>
          <Alert isFullWidth isDismissible={false} color="information" title="Prototype of a paid add-on" description="Your server and pay page are simulated here and nothing in your account changes. A real check sends your server one test payment, marked as a test, so it never gives a real customer anything." />
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
            <Stat label="Verdict" value={data.safe_to_release ? 'Safe to release' : 'Hold the release'} hint="from the checks below" icon={ShieldIcon} tone={data.safe_to_release ? 'positive' : 'negative'} />
            <Stat label="Checks passed" value={`${passed} of ${data.steps.length}`} hint={data.failed ? `${data.failed} failed` : 'none failed'} icon={CheckCircleIcon} tone={data.failed ? 'notice' : 'positive'} />
            <Stat label="Checked" value={when(data.checked_at)} hint="when the test event was sent" icon={ClockIcon} />
          </Box>

          {/* The verdict is already the first card, so the line says only what failed first. */}
          <Panel title={data.headline.replace(/^(Hold the release|Safe to release)\. /, '')} />

          <Panel title="Your webhook" subtitle="The test event is signed like a real payment and carries a marker, so it never grants a real customer anything">
            <Box display="flex" flexDirection="column" gap="spacing.5">{webhook.map((s) => <StepRow key={s.key} step={s} />)}</Box>
          </Panel>

          <Panel title="Your pay page" subtitle="What a customer gets when they open it and press Pay">
            <Box display="flex" flexDirection="column" gap="spacing.5">{page.map((s) => <StepRow key={s.key} step={s} />)}</Box>
          </Panel>

          <Panel title="Put it in your release script" subtitle="The line fails when it is not safe, so your release stops by itself">
            <Box overflow="auto"><Code size="medium">{data.ci_call}</Code></Box>
            <Box display="flex" flexDirection="column" gap="spacing.2" paddingTop="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle">
              <Text size="small" weight="semibold" color="surface.text.gray.subtle">How to read it, and what I cannot see</Text>
              <Box maxWidth="720px" display="flex" flexDirection="column" gap="spacing.2">
                <Text size="small" color="surface.text.gray.muted">Each check is a plain rule on what your side answered. A step that could not be tried because an earlier one failed is shown as not tried, never as passed.</Text>
                {data.cannot_see.map((c) => <Text key={c} size="small" color="surface.text.gray.muted">{c}</Text>)}
              </Box>
            </Box>
          </Panel>
        </>
      )}
    </Box>
  )
}
