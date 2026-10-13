import { Alert, Box, List, ListItem, Text } from '@razorpay/blade/components'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { useGet } from '../lib/api'

// The brand account's Integration and Settings pages, as `synth/brand_world.py` writes them (web/public/brand/integration.json, settings.json): topics, each a list of
// settings with what it does. Both are the Settings page template (web/DESIGN.md section 15): one Panel per topic, label above value. An account manager set them up and the
// demo cannot change them, so there are no controls and no Save button; an Alert says so.
type Row = { label: string; value?: string; code?: string; list?: string[]; note?: string }
type Section = { id: string; title: string; subtitle: string; rows: Row[] }
type Data = { set_up: string; demo?: string; sections: Section[] }

function Setting({ row, wide }: { row: Row; wide: boolean }) {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.2" gridColumn={wide ? '1 / -1' : undefined} minWidth="0px">
      <Text size="small" weight="semibold" color="surface.text.gray.muted">{row.label}</Text>
      {row.value && <Text>{row.value}</Text>}
      {/* An address has no spaces, and Blade's Code wraps only at spaces, so a long one ran off the card at 375px. Text breaks anywhere. */}
      {row.code && <Text weight="semibold" wordBreak="break-all">{row.code}</Text>}
      {row.list && <List size="small">{row.list.map((x) => <ListItem key={x}>{x}</ListItem>)}</List>}
      {row.note && <Text size="small" color="surface.text.gray.muted">{row.note}</Text>}
    </Box>
  )
}

function Sections({ path, title, description, testID }: { path: string; title: string; description: string; testID: string }) {
  const { data, error } = useGet<Data>(path)
  if (!data && !error) return <PageSkeleton />
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" testID={testID}>
      <PageHeader title={title} description={description} />
      {error && <Alert isFullWidth color="negative" isDismissible={false} title={`Could not load ${title.toLowerCase()}`} description={`${error}. Reload the page to try again.`} />}
      {data && <Alert isFullWidth color="information" isDismissible={false} title={data.demo ?? 'Demo: view only'} description={data.set_up} />}
      {data?.sections.map((s) => (
        <Panel key={s.id} title={s.title} subtitle={s.subtitle} testID={`section-${s.id}`}>
          {/* Two settings a row from m; a topic with one setting gives it the whole row. */}
          <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))' }} columnGap="spacing.7" rowGap="spacing.6">
            {s.rows.map((r) => <Setting key={r.label} row={r} wide={s.rows.length === 1} />)}
          </Box>
        </Panel>
      ))}
    </Box>
  )
}

// Integration for the brand (`/connect`): the alert door (PRD F4) and the shared Slack channel (F12, F13).
export function BrandIntegration() {
  return <Sections path="/api/brand/integration" title="Integration" testID="brand-integration"
    description="How your alert tools reach Blindspot, and how its answers reach your team in Slack." />
}

// Settings for the brand (`/settings`): what waits for approval, who approves, the limits, and when Razorpay support signs off (PRD F9, F13, F17).
export default function BrandSettings() {
  return <Sections path="/api/brand/settings" title="Settings" testID="brand-settings"
    description="What waits for approval, who approves, and the limits Blindspot never goes past." />
}
