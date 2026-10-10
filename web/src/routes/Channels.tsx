import { useState } from 'react'
import { Alert, AtSignIcon, Badge, Box, Button, Card, CardBody, ClipboardIcon, CornerUpRightIcon, Divider, FacebookIcon, FileTextIcon, Heading, HeadsetIcon, InstagramIcon, List, ListItem, MailIcon, MessageCircleIcon, SegmentedControl, SegmentedControlItem, Text, WhatsAppIcon, type IconComponent } from '@razorpay/blade/components'
import { isLive, send, useGet, type Schemas } from '../lib/api'
import { CHANNEL, sentence } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'

type Channel = Schemas['Channel']

const ICON: Record<string, IconComponent> = { help_button: HeadsetIcon, whatsapp_payments: WhatsAppIcon, email: MailIcon, ig_dm: InstagramIcon, fb_dm: FacebookIcon, public_mention: AtSignIcon, ray_forward: CornerUpRightIcon, paste: ClipboardIcon, csv: FileTextIcon }
// Channels the agent does not reply on: complaints you bring in yourself. One line each, since they have no consent or identity to show.
const INTAKE: Record<string, string> = { ray_forward: 'Complaints Ray passes on to Blindspot.', paste: 'Paste in a complaint from anywhere.', csv: 'Many complaints at once, from a file.' }

// The icon in a tinted tile, grey once the channel is off.
function Tile({ type, on }: { type: string; on: boolean }) {
  const Icon = ICON[type] ?? MessageCircleIcon
  return (
    <Box width="40px" height="40px" flexShrink={0} borderRadius="medium" backgroundColor={on ? 'surface.background.primary.subtle' : 'surface.background.gray.moderate'} display="flex" alignItems="center" justifyContent="center">
      <Icon size="large" color={on ? 'surface.icon.primary.normal' : 'surface.icon.gray.muted'} />
    </Box>
  )
}

// S-12. What the agent may read, who it speaks as, and the switch that stops it at once. Two groups: where customers write (the agent reads and
// replies there, so each card shows the consent), and where you bring complaints in yourself. Cards sit in a grid; the switch is at the top right.
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
  if (!chs) return <PageSkeleton />
  const talking = chs.filter((c) => c.reply_identity)
  const intake = chs.filter((c) => !c.reply_identity)
  const isOn = (c: Channel) => c.status === 'connected' && !(!isLive && off.includes(c.id))

  const card = (c: Channel) => {
    const mine = (consents ?? []).filter((k) => k.channel_id === c.id)
    const demoOff = !isLive && off.includes(c.id)
    const active = demoOff ? undefined : mine.find((k) => !k.revoked_at)
    const status = demoOff ? 'disconnected' : c.status
    const name = CHANNEL[c.type] ?? sentence(c.type)
    const control = !isLive && (demoOff
      ? <Button size="small" onClick={() => setOff((a) => a.filter((x) => x !== c.id))}>Undo, connect it again</Button>
      : c.status === 'connected' && <Button variant="secondary" size="small" onClick={() => setOff((a) => [...a, c.id])} accessibilityLabel={`Disconnect ${name}`}>Disconnect</Button>)
    return (
      <Card key={c.id} height="100%">
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.5" height="100%">
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap="spacing.4">
              <Box display="flex" gap="spacing.4" alignItems="center" minWidth="0px" flex="1">
                <Tile type={c.type} on={status === 'connected'} />
                <Box display="flex" flexDirection="column" gap="spacing.2" minWidth="0px">
                  <Heading size="small">{name}</Heading>
                  <Box display="flex" gap="spacing.2" flexWrap="wrap">
                    <Badge size="small" color={status === 'connected' ? 'positive' : 'neutral'}>{sentence(status)}</Badge>
                    {c.mocked && <Badge size="small" color="neutral">Simulated</Badge>}
                  </Box>
                </Box>
              </Box>
              {control && <Box flexShrink={0}>{control}</Box>}
            </Box>
            <Text size="small">Speaks as: {c.reply_identity}</Text>
            {demoOff && <Alert isFullWidth isDismissible={false} color="neutral" description="Disconnected. Ray has stopped reading and replying here." />}
            {active && (
              <Box display="flex" flexDirection="column" gap="spacing.2">
                <Text size="small" weight="semibold">You allowed it to:</Text>
                <List size="small">{active.scopes.map((s) => <ListItem key={s}>{s}</ListItem>)}</List>
              </Box>
            )}
            {!active && <Text size="small" color="surface.text.gray.muted">{mine.length > 0 || demoOff ? 'Consent withdrawn, so nothing from this channel is being processed.' : 'No active consent'}</Text>}
            {isLive && (
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
            {active && (
              <Box display="flex" flexDirection="column" gap="spacing.4" marginTop="auto">
                <Divider />
                <Text size="small" color="surface.text.gray.muted">Kept for {active.retention_days} days. Granted by {active.granted_by}.</Text>
              </Box>
            )}
          </Box>
        </CardBody>
      </Card>
    )
  }

  const group = (title: string, line: string, items: Channel[], cols: 2 | 3, body: (c: Channel) => JSX.Element) => items.length > 0 && (
    <Box display="flex" flexDirection="column" gap="spacing.4">
      <Box display="flex" flexDirection="column" gap="spacing.1">
        <Box display="flex" alignItems="center" gap="spacing.3"><Heading size="medium">{title}</Heading><Badge size="medium" color="neutral">{`${items.filter(isOn).length} of ${items.length} on`}</Badge></Box>
        <Text size="small" color="surface.text.gray.muted">{line}</Text>
      </Box>
      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: `repeat(${cols}, minmax(0, 1fr))` }} gap="spacing.5">{items.map(body)}</Box>
    </Box>
  )

  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" testID="channels">
      <PageHeader title="Channels" description="Where customers can reach the agent, what it may read, and who it speaks as. It always says it is an AI, and it can be switched off here at any moment." guide="channels" />
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Read-only snapshot" description="Changing autonomy is turned off in this demo. Disconnect and undo work, so you can see how control feels. Nothing is saved, and a reload puts everything back." />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="Not changed" description={error} />}
      {group('Where customers write to you', 'Blindspot replies here as your payment help, only with the consent shown on each card.', talking, 2, card)}
      {group('Ways you bring complaints in', 'Nothing is sent from these. They only add complaints to Conversations.', intake, 3, (c) => (
        <Card key={c.id} height="100%">
          <CardBody>
            <Box display="flex" gap="spacing.4" alignItems="flex-start">
              <Tile type={c.type} on={isOn(c)} />
              <Box display="flex" flexDirection="column" gap="spacing.2" minWidth="0px">
                <Heading size="small">{CHANNEL[c.type] ?? sentence(c.type)}</Heading>
                {INTAKE[c.type] && <Text size="small" color="surface.text.gray.muted">{INTAKE[c.type]}</Text>}
                <Box display="flex" gap="spacing.2" flexWrap="wrap">
                  <Badge size="small" color={c.status === 'connected' ? 'positive' : 'neutral'}>{sentence(c.status)}</Badge>
                  {c.mocked && <Badge size="small" color="neutral">Simulated</Badge>}
                </Box>
              </Box>
            </Box>
          </CardBody>
        </Card>
      ))}
    </Box>
  )
}
