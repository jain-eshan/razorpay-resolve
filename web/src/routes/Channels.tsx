import { useState } from 'react'
import { Alert, Badge, Box, Button, Card, CardBody, Heading, List, ListItem, SegmentedControl, SegmentedControlItem, Text } from '@razorpay/blade/components'
import { isLive, send, useGet, type Schemas } from '../lib/api'
import { CHANNEL, sentence } from '../lib/format'
import { PageHeader } from '../components/PageHeader'

type Channel = Schemas['Channel']

// S-12. What the agent may read, who it speaks as, and the switch that stops it at once.
export default function Channels() {
  const [v, setV] = useState(0)
  const { data: chs } = useGet<Channel[]>('/api/channels', v)
  const { data: consents } = useGet<Schemas['Consent'][]>('/api/consents', v)
  const [error, setError] = useState<string>()
  const [off, setOff] = useState<string[]>([])  // demo only: channels disconnected in this tab. Nothing is saved, a reload brings them back.
  const act = async (fn: () => Promise<unknown>) => {
    setError(undefined)
    try {
      await fn()
      setV((n) => n + 1)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (!chs) return <Text color="surface.text.gray.muted">Loading</Text>
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" testID="channels">
      <PageHeader title="Channels" description="Where customers can reach the agent, what it may read, and who it speaks as. It always says it is an AI, and it can be switched off here at any moment." guide="channels" />
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Read-only snapshot" description="Changing autonomy is turned off in this demo. Disconnect and undo work, so you can see how control feels. Nothing is saved, and a reload puts everything back." />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="Not changed" description={error} />}
      {chs.map((c) => {
        const mine = (consents ?? []).filter((k) => k.channel_id === c.id)
        const demoOff = !isLive && off.includes(c.id)
        const active = demoOff ? undefined : mine.find((k) => !k.revoked_at)
        const status = demoOff ? 'disconnected' : c.status
        const talks = !!c.reply_identity
        return (
          <Card key={c.id}><CardBody>
            <Box display="flex" flexDirection="column" gap="spacing.4">
              <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
                <Heading size="small">{CHANNEL[c.type] ?? sentence(c.type)}</Heading>
                <Badge color={status === 'connected' ? 'positive' : 'neutral'}>{sentence(status)}</Badge>
                {c.mocked && <Badge color="neutral">Simulated</Badge>}
              </Box>
              {talks && <Text size="small">Speaks as: {c.reply_identity}</Text>}
              {talks && (
                <Box display="flex" flexDirection="column" gap="spacing.2">
                  <Text size="small" weight="semibold">{active ? 'You allowed it to:' : 'No active consent'}</Text>
                  {active && <List size="small">{active.scopes.map((s) => <ListItem key={s}>{s}</ListItem>)}</List>}
                  {active && <Text size="small" color="surface.text.gray.muted">Kept for {active.retention_days} days. Granted by {active.granted_by}.</Text>}
                  {!active && (mine.length > 0 || demoOff) && <Text size="small" color="surface.text.gray.muted">Consent withdrawn, so nothing from this channel is being processed.</Text>}
                </Box>
              )}
              {talks && !isLive && (
                demoOff ? (
                  <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
                    <Button size="small" onClick={() => setOff((a) => a.filter((x) => x !== c.id))}>Undo, connect it again</Button>
                    <Text size="small" color="surface.text.gray.muted">Disconnected. Ray has stopped reading and replying here.</Text>
                  </Box>
                ) : c.status === 'connected' && (
                  <Box><Button variant="secondary" size="small" onClick={() => setOff((a) => [...a, c.id])}>Disconnect</Button></Box>
                )
              )}
              {talks && isLive && (
                <Box display="flex" gap="spacing.4" alignItems="flex-end" flexWrap="wrap">
                  <SegmentedControl label="Autonomy" name={`aut-${c.id}`} value={c.autonomy_level} onChange={({ value }) => act(() => send('PUT', `/api/channels/${c.id}`, { autonomy_level: value }))}>
                    <SegmentedControlItem value="suggest">Suggest</SegmentedControlItem>
                    <SegmentedControlItem value="assist">Assist</SegmentedControlItem>
                    <SegmentedControlItem value="autopilot_reversible">Autopilot</SegmentedControlItem>
                  </SegmentedControl>
                  {c.status === 'connected'
                    ? <Button variant="secondary" size="small" onClick={() => act(() => send('PUT', `/api/channels/${c.id}`, { status: 'disconnected' }))}>Disconnect</Button>
                    : !active
                      ? <Button size="small" onClick={() => act(() => send('POST', '/api/consents', { channel_id: c.id, scopes: ['Read payment-related messages', `Reply as ${c.reply_identity}`, 'Look up payments by an identifier the customer shares'], granted_by: 'founder' }))}>Allow it</Button>
                      : <Button size="small" onClick={() => act(() => send('PUT', `/api/channels/${c.id}`, { status: 'connected' }))}>Connect</Button>}
                </Box>
              )}
            </Box>
          </CardBody></Card>
        )
      })}
    </Box>
  )
}
