import { useState, type ReactNode } from 'react'
import { Alert, Badge, Box, Button, SegmentedControl, SegmentedControlItem, Switch, Text, TextInput } from '@razorpay/blade/components'
import { Panel } from '../components/Panel'
import { isLive, rupees, send, useGet, type Schemas } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'

type Settings = Schemas['Settings']

const LEVELS = [
  ['suggest', 'Review first', 'You approve every step: the test run, the first 5, the rest, and every message.'],
  ['assist', 'Approve once', 'You approve a fix once. It then goes out in steps by itself and stops if anything fails. Messages still need you.'],
  ['autopilot_reversible', 'Full automation', 'Fixes and messages go out by themselves within your limits. Grants can be undone. Messages cannot, so use it only when you trust the wording.'],
] as const

// What each permission level allows (v1 section 12.1). L2 is the messaging switch below. The others are fixed in this release.
const LADDER = [
  ['L0', 'Read and explain', 'Monitors, matching, investigation, drafts', 'On'],
  ['L1', 'Give access', 'Through your app, a few customers at a time', 'On'],
  ['L2', 'Message customers', 'Status messages from you as the sender', 'messaging'],
  ['L3', 'Refund double charges', 'To the original payment method, one customer at a time, within your daily limit', 'Asks you each time'],
  ['L4', 'Above the limit', 'More customers than your limit needs a second approver', 'Not in this release'],
] as const

// S-11
export default function SettingsPage() {
  const { data } = useGet<Settings>('/api/settings')
  const [edited, setS] = useState<Settings>()  // the founder's unsaved edits; until then show what the server has
  const s = edited ?? data
  const [saved, setSaved] = useState<string>()
  const [error, setError] = useState<string>()
  if (!s) return <PageSkeleton />

  // A disabled input reads as an empty placeholder, so the read-only demo shows the value as text.
  const ro = (label: string, value: string, hint?: string): ReactNode => (
    <Box display="flex" flexDirection="column">
      <Text size="small" color="surface.text.gray.muted">{label}</Text>
      <Text>{value}</Text>
      {hint && <Text size="small" color="surface.text.gray.muted">{hint}</Text>}
    </Box>
  )
  const num = (k: 'max_bulk_customers' | 'holdout_percent') => !isLive ? ro(k === 'max_bulk_customers' ? 'Most customers in one action' : 'Share of payment links held back to measure the effect (percent)', String(s[k])) : (
    <TextInput label={k === 'max_bulk_customers' ? 'Most customers in one action' : 'Share of payment links held back to measure the effect (percent)'} value={String(s[k])} isDisabled={!isLive}
      onChange={({ value }) => setS({ ...s, [k]: Number((value ?? '').replace(/\D/g, '')) })} />
  )
  const save = async () => {
    setError(undefined)
    try {
      setS(await send<Settings>('PUT', '/api/settings', s))
      setSaved('Saved. The audit trail has the change.')
    } catch (e) {
      setError((e as Error).message)
      setSaved(undefined)
    }
  }

  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" testID="settings">
      <PageHeader guide="autonomy" title="Settings" description="How much Blindspot does before asking you, and the limits it never goes past." />
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Demo: view only" description="Settings cannot be changed in this demo." />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="Not saved" description={error} />}

      <Panel title="Approvals" subtitle="How much Blindspot may do before it asks you">
        <SegmentedControl label="Level" name="autonomy" value={s.autonomy ?? 'suggest'} onChange={({ value }) => isLive && setS({ ...s, autonomy: value as Settings['autonomy'] })}>
          {LEVELS.map(([v, label]) => <SegmentedControlItem key={v} value={v}>{label}</SegmentedControlItem>)}
        </SegmentedControl>
        <Text>{LEVELS.find(([v]) => v === s.autonomy)?.[2]}</Text>
        <Text size="small" color="surface.text.gray.muted">Refunds and payment links to customers always wait for you, at every level. Refunds are approved one customer at a time.</Text>
      </Panel>

      <Panel title="Limits">
        <Box display="grid" gridTemplateColumns={{ base: '1fr', m: '1fr 1fr' }} gap="spacing.5">
          {num('max_bulk_customers')}
          {num('holdout_percent')}
          {!isLive ? ro('Daily refund limit', rupees(s.daily_refund_cap_paise), 'Refunds stop for the day once this much has gone out.') : <TextInput label="Daily refund limit" value={rupees(s.daily_refund_cap_paise)} isDisabled helpText="Refunds stop for the day once this much has gone out." />}
          {!isLive ? ro("Your developer's contact", s.technical_contact) : <TextInput label="Your developer's contact" value={s.technical_contact} onChange={({ value }) => setS({ ...s, technical_contact: value ?? '' })} />}
        </Box>
        {!isLive ? ro('Messages to customers', s.messaging_enabled ? 'Allowed' : 'Not allowed') : (
          <Box display="flex" gap="spacing.4" alignItems="center">
            <Switch accessibilityLabel="Allow messages to customers" isChecked={s.messaging_enabled} onChange={({ isChecked }) => setS({ ...s, messaging_enabled: isChecked })} />
            <Text>Allow messages to customers</Text>
          </Box>
        )}
      </Panel>

      <Panel title="What Blindspot is allowed to do">
        {LADDER.map(([lv, name, what, state]) => (
          <Box key={lv} paddingBottom="spacing.4" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
              <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
                <Box flex="1" minWidth="220px"><Text weight="semibold">{name}</Text><Text size="small" color="surface.text.gray.muted">{what}</Text></Box>
                <Badge color={state === 'On' || state === 'Asks you each time' || (state === 'messaging' && s.messaging_enabled) ? 'positive' : 'neutral'}>{state === 'messaging' ? (s.messaging_enabled ? 'On' : 'Off until you allow messages') : state}</Badge>
              </Box>
          </Box>
        ))}
        <Text size="small" color="surface.text.gray.muted">Never available at any level: switching access off, changing Razorpay settings, writing to your database directly, applying code, refunding to a new destination.</Text>
      </Panel>

      <Panel title="Your access records">
        <Text>{s.entitlement_connector.status} (from your export).</Text>
      </Panel>

      {isLive && (
        <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
          <Button onClick={save}>Save settings</Button>
          {saved && <Text size="small" color="feedback.text.positive.intense">{saved}</Text>}
        </Box>
      )}
    </Box>
  )
}
