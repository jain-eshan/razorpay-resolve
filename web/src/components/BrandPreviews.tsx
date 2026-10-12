import type { ReactNode } from 'react'
import { AlertTriangleIcon, Badge, Box, CheckCircleIcon, ChartBar, ChartBarWrapper, ChartXAxis, ChartYAxis, Heading, Text } from '@razorpay/blade/components'
import { rupees } from '../lib/api'
import { clock } from '../lib/time'
import { useNarrow } from '../lib/useNarrow'

// Where a brand's payment issue showed up outside Razorpay, drawn on the issue page as previews: what the customer's phone said, what the brand's alert tool sent, and the
// root cause in the brand's Slack channel. Names in text only, no logos and no look-alike colours: each preview is a framed Blade card with the tool's name on it, so it reads
// as "this is what was there" and never as the tool itself. Every word and figure comes from the issue's file (`synth/brand_world.py`).
export type AppPreview = { platform: string; version: string; amount_paise: number; item: string; said: string; true: string }
export type AlertPreview = { tool: string; issue: string; service: string; release: string; events: number; window_minutes: number; first_seen: string; forwarded_at: string; per_minute: { at: string; events: number }[]; rule: string }
export type SlackMessage = { who: string; at: string; text?: string; rca?: { title: string; lines: string[]; signed_off: string } }
export type SlackPreview = { channel: string; messages: SlackMessage[] }

// The frame every preview sits in: a thin strip naming the tool, then its content on white.
function Frame({ tool, where, children, testID }: { tool: string; where: string; children: ReactNode; testID: string }) {
  return (
    <Box borderWidth="thin" borderColor="surface.border.gray.normal" borderRadius="large" overflow="hidden" backgroundColor="surface.background.gray.intense" height="100%" display="flex" flexDirection="column" testID={testID}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing.3" paddingX="spacing.5" paddingY="spacing.3" backgroundColor="surface.background.gray.moderate" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
        <Text size="small" weight="semibold">{tool}</Text>
        <Text size="small" color="surface.text.gray.muted">{where}</Text>
      </Box>
      <Box padding="spacing.5" display="flex" flexDirection="column" gap="spacing.4" flex="1">{children}</Box>
    </Box>
  )
}

// The customer's phone after paying: what the app said, and under the phone what was true.
export function PhoneScreen({ p, count }: { p: AppPreview; count: number }) {
  return (
    <Frame tool={`Your ${p.platform} app ${p.version}`} where="what customers saw" testID="preview-app">
      <Box marginX="auto" width="100%" maxWidth="240px" borderWidth="thicker" borderColor="surface.border.gray.normal" borderRadius="large" padding="spacing.5" display="flex" flexDirection="column" alignItems="center" gap="spacing.3" textAlign="center">
        <Text size="small" color="surface.text.gray.muted">{p.item} · {rupees(p.amount_paise)}</Text>
        <AlertTriangleIcon size="2xlarge" color="feedback.icon.negative.intense" />
        <Heading size="small">{p.said}</Heading>
        <Text size="small" color="surface.text.gray.muted">Something went wrong. Please try again.</Text>
      </Box>
      <Box display="flex" alignItems="center" gap="spacing.2" justifyContent="center" flexWrap="wrap">
        <CheckCircleIcon size="small" color="feedback.icon.positive.intense" />
        <Text size="small">{`${p.true}, for all ${count.toLocaleString('en-IN')}`}</Text>
      </Box>
    </Frame>
  )
}

// The brand's alert, as its tool sent it to Razorpay: the error, how many in how long, a bar per minute, and the rule that forwarded it.
export function AlertCard({ a }: { a: AlertPreview }) {
  const narrow = useNarrow()
  const data = a.per_minute.map((m) => ({ minute: clock(m.at).replace(/ [ap]m$/, ''), events: m.events }))
  return (
    <Frame tool={a.tool} where={`${a.service} · ${a.release}`} testID="preview-alert">
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap="spacing.3" flexWrap="wrap">
        <Box display="flex" flexDirection="column">
          <Text weight="semibold">{a.issue}</Text>
          <Text size="small" color="surface.text.gray.muted">{`${a.events} events in ${a.window_minutes} minutes, first at ${clock(a.first_seen)}`}</Text>
        </Box>
        <Badge color="positive" size="medium" icon={CheckCircleIcon}>{`Sent to Razorpay ${clock(a.forwarded_at)}`}</Badge>
      </Box>
      <Box height="120px">
        <ChartBarWrapper data={data} height="100%">
          <ChartXAxis dataKey="minute" interval={narrow ? 2 : 1} />
          <ChartYAxis tickCount={3} allowDecimals={false} />
          <ChartBar dataKey="events" name="Events" color="data.background.categorical.red.intense" />
        </ChartBarWrapper>
      </Box>
      <Text size="small" color="surface.text.gray.muted">{a.rule}. Blindspot matches an alert to Razorpay's payments before it acts on it.</Text>
    </Frame>
  )
}

// The shared Slack channel: who posted what, and the root cause card. `replies` are the approvals made on the page, shown under the root cause as they would land in the thread.
export function SlackThread({ s, replies = [] }: { s: SlackPreview; replies?: string[] }) {
  return (
    <Frame tool="Slack" where={`#${s.channel} · shared with Razorpay`} testID="preview-slack">
      {s.messages.map((m) => (
        <Box key={`${m.who}${m.at}`} display="flex" gap="spacing.4" alignItems="flex-start">
          <Box width="32px" height="32px" flexShrink={0} borderRadius="medium" display="flex" alignItems="center" justifyContent="center"
            backgroundColor={m.who === 'Razorpay Blindspot' ? 'surface.background.primary.intense' : 'surface.background.gray.moderate'}>
            <Text size="small" weight="semibold" color={m.who === 'Razorpay Blindspot' ? 'surface.text.staticWhite.normal' : 'surface.text.gray.muted'}>{m.who[0]}</Text>
          </Box>
          <Box display="flex" flexDirection="column" gap="spacing.2" minWidth="0px" flex="1">
            <Box display="flex" alignItems="baseline" gap="spacing.3" flexWrap="wrap">
              <Text size="small" weight="semibold">{m.who}</Text>
              <Text size="xsmall" color="surface.text.gray.muted">{clock(m.at)}</Text>
            </Box>
            {m.text && <Text size="small">{m.text}</Text>}
            {m.rca && (
              <Box borderLeftWidth="thicker" borderLeftColor="surface.border.primary.normal" paddingLeft="spacing.4" display="flex" flexDirection="column" gap="spacing.2" testID="slack-rca">
                <Text size="small" weight="semibold">{m.rca.title}</Text>
                {m.rca.lines.map((l) => <Text key={l} size="small">{l}</Text>)}
                <Text size="xsmall" color="surface.text.gray.muted">{m.rca.signed_off}</Text>
                {replies.map((r) => <Text key={r} size="small" color="feedback.text.positive.intense">{r}</Text>)}
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Frame>
  )
}
