import { Badge, Box, Card, CardBody, CheckCircleIcon, ActivityIcon, BellIcon, ChartBar, ChartBarWrapper, ChartCartesianGrid, ChartTooltip, ChartXAxis, ChartYAxis, Heading, Text, ClockIcon } from '@razorpay/blade/components'
import { ChartKey } from '../components/ChartKey'
import { DemoFrame, DemoLoading } from '../components/DemoPath'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { yTop } from '../lib/format'
import { BRAND, clock, minutesBetween, useJ2 } from '../lib/brand'
import { useNarrow } from '../lib/useNarrow'

// A generic monitoring page (roadmap J4). It says "Sentry" in words and has no logo or look-alike styling: it shows what the brand's own tool would show, and that the payment
// errors were forwarded to Razorpay. The brand has to do nothing else for Blindspot to hear about the problem.
export default function DemoAlert() {
  const { data: j2, error } = useJ2()
  const narrow = useNarrow()  // ten labels do not fit a phone: every third one, without "pm"
  if (!j2) return <DemoLoading at={1} error={error} />
  const { sentry, timeline: t } = j2
  const data = sentry.per_minute.map((m) => ({ minute: narrow ? clock(m.at).replace(/ [ap]m$/, '') : clock(m.at), events: m.events }))
  const first = sentry.per_minute.find((m) => m.events > 0)!
  const latest = sentry.per_minute.filter((m) => m.events > 0).slice(-3).reverse()

  return (
    <DemoFrame at={1} guide={`${sentry.events} errors in ${sentry.window_minutes} minutes. The alert rule sends the payment ones to Razorpay, so nobody has to copy them over.`}>
      <Card testID="alert-header">
        <CardBody>
          <Box display="flex" flexDirection={{ base: 'column', l: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', l: 'center' }} gap="spacing.4">
            <Box display="flex" flexDirection="column" gap="spacing.2" minWidth="0px">
              <Text size="small" weight="semibold" color="surface.text.gray.muted">{`Sentry · ${j2.platform.toLowerCase()}@${j2.app_version} · production`}</Text>
              <Heading as="h1" size="large">{sentry.issue}</Heading>
              <Text color="surface.text.gray.muted">{`${sentry.service} · ${BRAND} payments`}</Text>
            </Box>
            <Box display="flex" flexDirection="column" alignItems={{ base: 'flex-start', l: 'flex-end' }} gap="spacing.2">
              <Badge color="positive" size="large" icon={CheckCircleIcon}>Forwarded to Razorpay</Badge>
              <Text size="small" color="surface.text.gray.muted">{`Sent at ${clock(t.alert)}`}</Text>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
        <Stat label="Events" value={String(sentry.events)} hint={`in ${sentry.window_minutes} minutes`} icon={ActivityIcon} tone="notice" />
        <Stat label="First seen" value={clock(first.at)} hint={`${minutesBetween(first.at, t.alert)} minutes before the alert`} icon={ClockIcon} />
        <Stat label="Alert fired" value={clock(t.alert)} hint="payment errors rule" icon={BellIcon} />
      </Box>

      <Panel title="Events per minute" subtitle={`${sentry.issue} on ${sentry.service}`}>
        <Box height="260px" testID="alert-chart">
          <ChartBarWrapper data={data} height="100%">
            <ChartCartesianGrid />
            <ChartXAxis dataKey="minute" interval={narrow ? 2 : 0} />
            <ChartYAxis label="Events per minute" tickCount={4} allowDecimals={false} domain={[0, (max: number) => yTop(max)]} />
            <ChartTooltip />
            <ChartBar dataKey="events" name="Events" color="data.background.categorical.red.intense" />
          </ChartBarWrapper>
        </Box>
        <ChartKey items={[{ name: 'PaymentVerificationError events', color: 'red' }]} />
      </Panel>

      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(2, minmax(0, 1fr))' }} gap="spacing.5" alignItems="stretch">
        <Panel title="Latest events" fill>
          {latest.map((m, i) => (
            <Box key={m.at} display="flex" flexDirection="column" paddingBottom="spacing.3" borderBottomWidth={i < latest.length - 1 ? 'thin' : 'none'} borderBottomColor="surface.border.gray.subtle">
              <Text weight="semibold">{sentry.issue}</Text>
              <Text size="small" color="surface.text.gray.muted">{`${clock(m.at)} · No verify-payment call for payment ${j2.sample_payment_ids[i]}`}</Text>
            </Box>
          ))}
        </Panel>
        <Panel title="Alert rule" fill>
          <Text>When payment errors spike, send them to Razorpay Blindspot.</Text>
          <Text size="small" color="surface.text.gray.muted">{`Only errors from ${sentry.service} are sent. Nothing else from ${BRAND}'s account leaves it, and an alert on its own is not acted on: Blindspot first matches it to Razorpay's payment data.`}</Text>
          <Text size="small" color="surface.text.gray.muted">Sentry groups errors from the server. It does not count every failed payment: Blindspot finds those in Razorpay's data.</Text>
        </Panel>
      </Box>
    </DemoFrame>
  )
}
