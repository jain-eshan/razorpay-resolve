import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, AtSignIcon, Badge, Box, Button, Card, CardBody, HeadsetIcon, Heading, InstagramIcon, MailIcon, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TablePagination, TableRow, Text, WhatsAppIcon, type IconComponent } from '@razorpay/blade/components'
import { ThreadView } from '../components/ThreadView'
import { isLive, useGet, type Schemas } from '../lib/api'
import { demoNote } from '../lib/demo'
import { CHANNEL, customerLabel, sentence, when } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { PageSkeleton } from '../components/PageSkeleton'

// The five ways to play the customer. Each is a card with the channel's icon, so they read as places to start, not as filters.
const DEMOS: [string, string, string, IconComponent][] = [
  ['/chat-demo', 'Talk to it on WhatsApp', 'Write as a customer and see what you see.', WhatsAppIcon],
  ['/help-demo/receipt', 'Tap help on a receipt', 'Start from the help button on a payment receipt.', HeadsetIcon],
  ['/email-demo', 'Write to it by email', 'Send a complaint to the payments address.', MailIcon],
  ['/ig-demo', 'Instagram: control passes and returns', 'A person takes over the thread, then hands it back.', InstagramIcon],
  ['/public-demo', 'A public post', 'A post is watched and never answered in public.', AtSignIcon],
]
const MATCH_TONE = { matched: 'positive', needs_detail: 'notice', no_payment_found: 'notice', not_payment: 'neutral' } as const
const MATCH_LABEL = { matched: 'Payment found', needs_detail: 'Needs a reference', no_payment_found: 'No payment found', not_payment: 'Not about a payment' }
// What the complaint is about, from the kind of problem it was matched to.
const ABOUT: Record<string, string> = { A: 'Paid, no access', E: 'Charged twice', G: 'Renewal failed', Z1: 'Could not pay', B: 'Payment failed, money taken', F: 'Refund not received' }

// S-04 list and S-14 founder side: every conversation, newest first, and the complaints that were already in the data.
export function Threads() {
  const nav = useNavigate()
  const [v, setV] = useState(0)
  const { data: threads, error } = useGet<Schemas['ThreadSummary'][]>('/api/threads', v)
  const { data: cases } = useGet<Schemas['CaseSummary'][]>('/api/cases', v)
  void setV
  const [shown, setShown] = useState(10)  // phone cards, ten at a time like the table's pages
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <PageHeader title="Customer complaints" description="Customers who wrote to your payment help about a payment. The assistant finds the payment, tells them what your records show, and hands over to you when a person is needed." guide="conversations" />
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Demo" description={`${demoNote} Start one under Try it as a customer, below, and it shows up here.`} />}
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      {threads && threads.length > 0 && <Heading as="h2" size="medium">Live conversations</Heading>}
      {threads?.map((t) => (
        <Link key={t.id} to={`/threads/${t.id}`} style={{ textDecoration: 'none' }}>
          <Card><CardBody>
            <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
              <Text weight="semibold">{CHANNEL[t.channel] ?? sentence(t.channel)}</Text>
              <Badge color={t.state === 'human' || t.state === 'handoff' ? 'negative' : t.state === 'resolved' || t.state === 'wait_for_fix' ? 'positive' : 'neutral'}>{sentence(t.state)}</Badge>
              {t.incident_id && <Badge color="neutral">{t.incident_id}</Badge>}
              <Text size="small" color="surface.text.gray.muted">{when(t.last_inbound_at)} · {customerLabel(t.customer_ref)}</Text>
            </Box>
          </CardBody></Card>
        </Link>
      ))}

      {/* Complaints already in the data, as the dashboard lists things: a table, newest first, ten to a page. The channel is the link to the case. */}
      {cases && cases.length > 0 && (
        <Panel title="Complaints" subtitle="Newest first" pad={false} trailing={<Text size="small" color="surface.text.gray.muted">{`${cases.length} complaints, ${cases.filter((c) => c.match_status === 'matched').length} matched to a payment`}</Text>}>
          {/* The link is the time it came in, so each row's link names that complaint, not the channel again. Below l, one card per complaint. */}
          <Box display={{ base: 'none', l: 'block' }}>
          <Table data={{ nodes: cases }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(150px, 1.2fr) minmax(150px, 1.3fr) minmax(170px, 1.5fr) minmax(150px, 1.3fr) minmax(110px, 0.9fr)" isHeaderSticky={false}>
            {(rows) => (
              <>
                <TableHeader><TableHeaderRow><TableHeaderCell>Received</TableHeaderCell><TableHeaderCell>About</TableHeaderCell><TableHeaderCell>Came in by</TableHeaderCell><TableHeaderCell>Payment</TableHeaderCell><TableHeaderCell>Payment issue</TableHeaderCell></TableHeaderRow></TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id} item={c}>
                      <TableCell><Link to={`/cases/${c.id}`} style={{ textDecoration: 'none' }}><Text weight="semibold" color="interactive.text.primary.normal">{when(c.received_at)}</Text></Link></TableCell>
                      <TableCell><Text size="small">{c.mismatch_type ? ABOUT[c.mismatch_type] ?? '' : MATCH_LABEL[c.match_status]}</Text></TableCell>
                      <TableCell><Text size="small">{CHANNEL[c.channel] ?? sentence(c.channel)}</Text></TableCell>
                      <TableCell><Badge size="medium" color={MATCH_TONE[c.match_status]}>{MATCH_LABEL[c.match_status]}</Badge></TableCell>
                      <TableCell>{c.incident_id ? <Box display="flex" flexDirection="column"><Link to={`/incidents/${c.incident_id}`} style={{ textDecoration: 'none' }}><Text size="small" weight="semibold" color="interactive.text.primary.normal">Open the issue</Text></Link><Text size="small" color="surface.text.gray.muted">{c.incident_id}</Text></Box> : <Text size="small" color="surface.text.gray.muted">None</Text>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </>
            )}
          </Table>
          </Box>
          <Box display={{ base: 'block', l: 'none' }}>
            {cases.slice(0, shown).map((c) => (
              <Box key={c.id} padding="spacing.5" display="flex" flexDirection="column" gap="spacing.2" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                <Link to={`/cases/${c.id}`} style={{ textDecoration: 'none' }}><Text weight="semibold" color="interactive.text.primary.normal">{when(c.received_at)}</Text></Link>
                <Text size="small">{c.mismatch_type ? ABOUT[c.mismatch_type] ?? '' : MATCH_LABEL[c.match_status]}</Text>
                <Text size="small" color="surface.text.gray.muted">{`${CHANNEL[c.channel] ?? sentence(c.channel)}${c.incident_id ? ` · ${c.incident_id}` : ''}`}</Text>
                <Box><Badge size="small" color={MATCH_TONE[c.match_status]}>{MATCH_LABEL[c.match_status]}</Badge></Box>
              </Box>
            ))}
            {cases.length > shown && <Box padding="spacing.5"><Button variant="secondary" size="medium" isFullWidth onClick={() => setShown(shown + 10)}>{`Show 10 more of ${cases.length - shown}`}</Button></Box>}
          </Box>
        </Panel>
      )}
      <Box display="flex" flexDirection="column" gap="spacing.4">
        <Box display="flex" flexDirection="column" gap="spacing.1"><Heading as="h2" size="medium">Try it as a customer</Heading><Text size="small" color="surface.text.gray.muted">Write in the way a customer would, and see what you would see.</Text></Box>
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.4">
          {/* Five cards: WhatsApp, the fullest demo, takes a whole row at m and two thirds of one at xl, so no row is left with a gap. */}
          {DEMOS.map(([to, label, line, Icon], i) => (
            <Box key={to} gridColumn={i === 0 ? { base: 'auto', m: '1 / -1', xl: 'span 2' } : 'auto'}><Card onClick={() => nav(to)} accessibilityLabel={label} height="100%" padding="spacing.5">
              <CardBody>
                <Box display="flex" gap="spacing.4" alignItems="flex-start">
                  <Box width="40px" height="40px" flexShrink={0} borderRadius="medium" backgroundColor="surface.background.primary.subtle" display="flex" alignItems="center" justifyContent="center"><Icon size="large" color="surface.icon.primary.normal" /></Box>
                  <Box display="flex" flexDirection="column" gap="spacing.1"><Heading as="h3" size="small">{label}</Heading><Text size="small" color="surface.text.gray.muted">{line}</Text></Box>
                </Box>
              </CardBody>
            </Card></Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

export function ThreadPage() {
  const { id = '' } = useParams()
  const [v, setV] = useState(0)
  const { data, error } = useGet<Schemas['ThreadDetail']>(`/api/threads/${id}`, v)
  if (error) return <Text color="feedback.text.negative.intense">Could not load {id}: {error}</Text>
  if (!data) return <PageSkeleton />
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Box display="flex" gap="spacing.5" flexWrap="wrap">
        <Link to="/threads" style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">All complaints</Text></Link>
        {data.case && <Link to={`/cases/${data.case.id}`} style={{ textDecoration: 'none' }}><Text size="small" color="interactive.text.primary.normal">Open the case</Text></Link>}
      </Box>
      <ThreadView thread={data} onChanged={() => setV((n) => n + 1)} />
    </Box>
  )
}
