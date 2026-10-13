import { useState } from 'react'
import { ActivityIcon, Alert, Badge, BellIcon, Box, Button, Card, CardBody, Divider, Heading, HeadsetIcon, MessageSquareIcon, Text, type IconComponent } from '@razorpay/blade/components'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { useGet } from '../lib/api'

// The brand's connectors as `synth/brand_world.py` writes them (web/public/brand/connectors.json): its alert tools, Razorpay's own monitor, Slack, and a helpdesk that comes later.
type Connector = { id: string; name: string; kind: 'alert' | 'razorpay' | 'slack' | 'helpdesk'; status: 'connected' | 'on' | 'later'; sends: string; count: string; last: string; off: string }
type Group = { id: string; title: string; items: Connector[] }

// A tool is named in text only, with a plain Blade icon for what it is (no logos, web/DESIGN.md section 15, Two accounts).
const ICON: Record<Connector['kind'], IconComponent> = { alert: BellIcon, razorpay: ActivityIcon, slack: MessageSquareIcon, helpdesk: HeadsetIcon }
const STATUS = { connected: 'Connected', on: 'On', later: 'Coming later' } as const

// The icon in a tinted tile, grey once it is off or not built yet (as on Kaksha's Connectors).
function Tile({ icon: Icon, on }: { icon: IconComponent; on: boolean }) {
  return (
    <Box width="40px" height="40px" flexShrink={0} borderRadius="medium" backgroundColor={on ? 'surface.background.primary.subtle' : 'surface.background.gray.moderate'} display="flex" alignItems="center" justifyContent="center">
      <Icon size="large" color={on ? 'surface.icon.primary.normal' : 'surface.icon.gray.muted'} />
    </Box>
  )
}

// Connectors for the brand (`/channels`): one grid of cards, each with what it sends, what it sent lately and a status. Disconnect and Undo show the control a merchant
// has (web/DESIGN.md section 21, "Control must be visible in the demo"); the change lives in this tab only.
export default function BrandConnectors() {
  const { data, error } = useGet<{ groups: Group[] }>('/api/brand/connectors')
  const [off, setOff] = useState<string[]>([])
  if (!data && !error) return <PageSkeleton />
  const all = (data?.groups ?? []).flatMap((g) => g.items.map((c) => ({ ...c, group: g.title })))
  const live = all.filter((c) => c.status !== 'later')
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" testID="brand-connectors">
      <PageHeader title="Connectors" description="The tools that tell Blindspot about problems, and the channel its answers go to. You can switch any of them off here." />
      {error
        ? <Alert isFullWidth color="negative" isDismissible={false} title="Could not load connectors" description={`${error}. Reload the page to try again.`} />
        : <Alert isFullWidth color="information" isDismissible={false} title="Demo: every connector is simulated" description="Try Disconnect and Undo to see how control works. Nothing is saved, and a reload puts everything back." />}
      {data && (
        <Box display="flex" flexDirection="column" gap="spacing.4">
          <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap">
            <Heading as="h2" size="medium">Your connectors</Heading>
            <Badge size="medium" color="neutral">{`${live.filter((c) => !off.includes(c.id)).length} of ${live.length} on`}</Badge>
          </Box>
          {/* Three across from l, so the six fill two rows; one column below. Every card stretches to its row, so a short one does not end early. */}
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
            {all.map((c) => {
              const isOff = off.includes(c.id)
              const on = c.status !== 'later' && !isOff
              return (
                <Card key={c.id} height="100%" testID={`connector-${c.id}`}>
                  <CardBody height="100%">
                    <Box display="flex" flexDirection="column" gap="spacing.4" height="100%">
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap="spacing.4">
                        <Box display="flex" gap="spacing.4" alignItems="center" minWidth="0px" flex="1">
                          <Tile icon={ICON[c.kind]} on={on} />
                          <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="0px">
                            <Text size="small" color="surface.text.gray.muted">{c.group}</Text>
                            <Heading as="h3" size="small">{c.name}</Heading>
                          </Box>
                        </Box>
                        <Badge size="small" color={on ? 'positive' : 'neutral'}>{isOff ? 'Off' : STATUS[c.status]}</Badge>
                      </Box>
                      <Text size="small">{c.sends}</Text>
                      {isOff && <Alert isFullWidth isDismissible={false} color="neutral" description={c.off} />}
                      <Box display="flex" flexDirection="column" gap="spacing.4" marginTop="auto">
                        <Divider />
                        <Box display="flex" justifyContent="space-between" alignItems="center" gap="spacing.3" flexWrap="wrap">
                          <Box display="flex" flexDirection="column">
                            {c.status === 'later'
                              ? <Text size="small" color="surface.text.gray.muted">Not connected in this release</Text>
                              : <><Text size="small" color="surface.text.gray.muted">{c.count}</Text><Text size="small" color="surface.text.gray.muted">{c.last}</Text></>}
                          </Box>
                          {c.status !== 'later' && (isOff
                            ? <Button size="small" onClick={() => setOff((a) => a.filter((x) => x !== c.id))}>{c.status === 'on' ? 'Undo, switch it on' : 'Undo, connect it again'}</Button>
                            : <Button variant="secondary" size="small" onClick={() => setOff((a) => [...a, c.id])} accessibilityLabel={`${c.status === 'on' ? 'Switch off' : 'Disconnect'} ${c.name}`}>{c.status === 'on' ? 'Switch off' : 'Disconnect'}</Button>)}
                        </Box>
                      </Box>
                    </Box>
                  </CardBody>
                </Card>
              )
            })}
          </Box>
        </Box>
      )}
    </Box>
  )
}
