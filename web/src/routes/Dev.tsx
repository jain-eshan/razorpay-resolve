import { useParams } from 'react-router-dom'
import { Alert, Box, Button, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { Crumbs } from '../components/Crumbs'
import { Panel } from '../components/Panel'
import { useGet, type Schemas } from '../lib/api'
import { OWNER, when } from '../lib/format'

function download(name: string, type: string, body: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

// S-07. Read-only and shareable: opening the link changes nothing. Payment ids and masked names only, no contact details.
export default function Dev() {
  const { id = '' } = useParams()
  const { data: inc, error } = useGet<Schemas['IncidentDetail']>(`/api/incidents/${id}`)
  const { data: pack } = useGet<Schemas['EvidencePack']>(`/api/incidents/${id}/evidence_pack`)
  const { data: members } = useGet<Schemas['Member'][]>(`/api/incidents/${id}/members`)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!inc || !pack) return <Text color="surface.text.gray.muted">Loading</Text>

  const csv = ['payment_id,customer,amount_inr,plan,webhook_outcome,your_record,group', ...(members ?? []).map((m) =>
    [m.payment_id, m.customer_masked, m.amount_paise / 100, m.plan, m.delivery_outcome, m.merchant_state, m.tier].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n')

  return (
    <Box display="flex" flexDirection="column" gap="spacing.7" testID="dev-handoff">
      <Crumbs items={[{ label: 'Incidents', to: '/incidents' }, { label: id, to: `/incidents/${id}` }, { label: 'For your developer', to: `/incidents/${id}/dev` }]} />
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="xlarge">For your developer</Heading>
        <Text color="surface.text.gray.muted">Reference {pack.ref}. Read-only. Opening this page changes nothing.</Text>
      </Box>

      <Alert color="notice" isDismissible={false} title={OWNER[inc.owner]} description={inc.title} />

      <Panel title="What happened">
        {pack.endpoint && <Text>Endpoint: {pack.endpoint}</Text>}
        {pack.first_failure_at && <Text>First failure: {when(pack.first_failure_at)}{pack.last_failure_at ? `. Last failure: ${when(pack.last_failure_at)}` : ''}</Text>}
        {pack.linked_change && <Text>Change at that time: {pack.linked_change}</Text>}
        {pack.response_excerpt && (
          <Box backgroundColor="surface.background.gray.subtle" borderRadius="medium" padding="spacing.5">
            <Text size="small" color="surface.text.gray.muted">What your server answered</Text>
            <Text size="small">{pack.response_excerpt}</Text>
          </Box>
        )}
        <Text>{pack.affected_events} webhook events and {pack.affected_payment_ids.length} paid customers are affected.</Text>
      </Panel>

      <Panel title="What to change">
        <Text>{pack.suggested_fix}</Text>
        <Text size="small" color="surface.text.gray.muted">This is a suggestion. Blindspot never changes your code and never turns off signature checking.</Text>
      </Panel>

      <Panel title="Affected payments">
        <Box display="flex" gap="spacing.4" flexWrap="wrap">
          <Button variant="secondary" size="small" onClick={() => download(`${pack.ref}.json`, 'application/json', JSON.stringify(pack, null, 2))}>Download JSON</Button>
          <Button variant="secondary" size="small" onClick={() => download(`${pack.ref}.csv`, 'text/csv', csv)}>Download CSV</Button>
          <Button variant="secondary" size="small" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy link</Button>
        </Box>
        <Card>
          <CardBody>
            <Box display="flex" flexDirection="column" gap="spacing.2" maxHeight="320px" overflow="auto">
              {pack.affected_payment_ids.map((p) => <Text key={p} size="small">{p}</Text>)}
            </Box>
          </CardBody>
        </Card>
      </Panel>
    </Box>
  )
}
