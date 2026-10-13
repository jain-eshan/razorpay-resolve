import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, AlertTriangleIcon, Badge, Box, Button, Card, CardBody, CheckCircleIcon, Heading, RupeesIcon, SegmentedControl, SegmentedControlItem, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableHeaderRow, TablePagination, TableRow, Text, UsersIcon,
} from '@razorpay/blade/components'
import { Crumbs } from '../components/Crumbs'
import { EvidenceLane } from '../components/EvidenceLane'
import { JustYou } from '../components/JustYou'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { StoryTiles, type StoryStep } from '../components/StoryStrip'
import { rupees } from '../lib/api'
import { approveAction, BRAND, canApproveAction, clock, useBrandIssues, useIssueApproved } from '../lib/brand'
import { cause, OWNER } from '../lib/format'
import { Field, Pair } from '../components/BrandBits'
import { n, two } from '../lib/brandBits'

// The brand's other payment issues (one page each, `web/public/brand/issues.json`). Same parts as the headline issue (BrandIssue.tsx), fed from the data: the story strip, three
// numbers, the evidence lane, "Is it just you?", root cause and actions, and the affected customers. Approvals here are this tab's only (lib/brand.ts) and the list shows them.
export default function BrandIssueDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, error } = useBrandIssues()
  const done = useIssueApproved(id ?? '')
  const [picked, setPicked] = useState<string>()
  if (error) return <Alert isFullWidth color="negative" isDismissible={false} title="The demo data did not load" description={`${error}. Reload the page. If it keeps failing, run "uv run python -m synth.brand_issues" and reload.`} />
  if (!data) return <PageSkeleton />
  const issue = data.find((i) => i.id === id)
  if (!issue) return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <Crumbs items={[{ label: 'Payment issues', to: '/demo/issues' }]} />
      <Alert isFullWidth color="notice" isDismissible={false} title="This issue is not in the demo" description="Go back to the list of issues and pick one from there." />
    </Box>
  )

  const { counts: c, groups, actions } = issue
  const [g0, g1] = groups
  const before = issue.zone === 'before'
  // "Approved", not "closed": approving a list sent to the bank or the brand does not fix anything, so the page never says a customer is put right (the story's issue page, J2, still does, for its refunds and its order list).
  const closed = actions.every((a) => done.includes(a.id))
  const fixed = Math.min(c.affected, actions.filter((a) => a.kind === 'fix' && done.includes(a.id)).reduce((s, a) => s + a.covers, 0))
  const told = actions.filter((a) => a.kind === 'tell' && done.includes(a.id)).reduce((s, a) => s + a.covers, 0)
  const how = issue.inferred ? 'About ' : ''
  const steps: StoryStep[] = [
    { title: 'Hear', done: true, value: 'Alert from Blindspot', note: `${clock(issue.alert_at)}, from ${before ? "the brand's checkout events" : "payments and the brand's orders"}` },
    { title: 'Find everyone', done: true, value: `${how}${n(c.affected)} customers ${before ? 'could not pay' : 'hit'}`, note: `${g0.label}: ${how.toLowerCase()}${n(g0.count)}, ${g1.label}: ${how.toLowerCase()}${n(g1.count)}` },
    { title: 'Whose side', done: true, value: cause(issue), note: issue.confidence },
    { title: 'Fix', done: fixed === c.affected, value: `${n(fixed)} of ${n(c.affected)} covered`, note: closed ? 'all approved' : done.length ? 'in progress' : 'needs your approval' },
    { title: 'Win back', done: told > 0, value: told > 0 ? `${n(told)} to be told` : 'No one told yet', note: told > 0 ? 'message approved' : 'needs your approval' },
  ]
  const next = actions.find((a) => canApproveAction(actions, a.id, done))?.id  // the one blue button: the first step still waiting that can go now
  const group = picked ?? g0.id
  const shown = issue.customers.filter((x) => x.group === group)

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="spacing.3">
        <Crumbs items={[{ label: 'Payment issues', to: '/demo/issues' }, { label: `${BRAND}: ${issue.short}`, to: `/demo/issues/${issue.id}` }]} />
        <Button variant={closed ? 'primary' : 'tertiary'} size="medium" onClick={() => nav('/demo/issues')}>Back to all issues</Button>
      </Box>

      <Card padding="spacing.5">
        <CardBody>
          <Box display="flex" gap="spacing.5" alignItems="center" flexWrap="wrap">
            <Box width="56px" height="56px" borderRadius="medium" backgroundColor="feedback.background.notice.subtle" display="flex" alignItems="center" justifyContent="center">
              <AlertTriangleIcon size="xlarge" color="feedback.icon.notice.intense" />
            </Box>
            <Box display="flex" flexDirection="column" gap="spacing.2" flex="1" minWidth="240px">
              <Heading as="h1" size="medium">{issue.headline}</Heading>
              <Text size="small" color="surface.text.gray.muted">{issue.cause}</Text>
              <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                <Badge color={issue.owner === 'bank' ? 'neutral' : 'notice'} size="medium">{cause(issue)}</Badge>
                <Badge color={closed ? 'positive' : 'notice'} size="medium">{closed ? 'Approved' : 'Open'}</Badge>
                <Text size="small" color="surface.text.gray.muted">{`${issue.confidence} · started ${clock(issue.started_at)} · ${before ? 'before payment' : 'after payment'} · demo issue`}</Text>
              </Box>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <StoryTiles steps={steps} />

      {/* Both messages sit in one grid cell and the one not showing is hidden, so the cell is as tall as the taller of the two and nothing below it moves when the last approval is made. */}
      <Box display="grid" testID="issue-banner">
        <Box gridArea="1 / 1" visibility={closed ? 'hidden' : 'visible'}><Alert isFullWidth color="information" isDismissible={false} title={issue.banner.title} description={issue.banner.text} /></Box>
        <Box gridArea="1 / 1" visibility={closed ? 'visible' : 'hidden'}><Alert isFullWidth color="positive" isDismissible={false} title="All actions approved" description={issue.closing} /></Box>
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5" testID="brand-stats">
        <Stat label={before ? 'Customers who could not pay' : 'Customers hit'} value={`${how}${n(c.affected)}`} hint={`${rupees(issue.money_paise)} ${issue.money_hint}`} icon={AlertTriangleIcon} tone="notice" />
        <Stat label={g0.label} value={`${how}${n(g0.count)}`} hint={`${rupees(g0.money_paise)} ${g0.hint}`} icon={UsersIcon} />
        <Stat label={g1.label} value={`${how}${n(g1.count)}`} hint={`${rupees(g1.money_paise)} ${g1.hint}`} icon={RupeesIcon} />
      </Box>

      <EvidenceLane rows={issue.rows.map((r) => ({ ...r, name: r.name.replace('{brand}', BRAND) }))} onset={issue.started_at} axis={{ from: issue.axis_from, to: issue.axis_to }} />
      <JustYou inc={{ lift: issue.lift.map((r) => ({ ...r, lift: r.lift ?? 0 })), verdict: { what_we_cannot_see: [issue.cannot_see] } }} compared={issue.compared} />

      <Pair>
        <Panel title="Root cause" fill>
          <Field label="Cause"><Text>{issue.cause}</Text></Field>
          <Field label="The fix"><Text>{issue.fix}</Text></Field>
          <Field label="Whose side">
            <Box display="flex" alignItems="center" gap="spacing.3" flexWrap="wrap">
              <Badge size="medium" color={issue.owner === 'bank' ? 'neutral' : 'notice'}>{OWNER[issue.owner]}</Badge>
              <Text size="small" color="surface.text.gray.muted">{issue.confidence}</Text>
            </Box>
            <Box display="flex" flexDirection="column" paddingTop="spacing.2">
              {issue.signals.map((s) => <Text key={s} size="small" color="surface.text.gray.muted">{s}</Text>)}
            </Box>
          </Field>
          <Field label={`Sample ${issue.sample_note}`}><Text size="small" color="surface.text.gray.muted">{issue.sample_payment_ids.slice(0, 3).join(', ')}</Text></Field>
        </Panel>
        <Panel title="Actions, need your approval" fill>
          {actions.map((a) => (
            <Box key={a.id} display="flex" flexDirection="column" gap="spacing.2" testID={`action-${a.id}`}>
              <Text weight="semibold">{a.title}</Text>
              <Text size="small" color="surface.text.gray.muted">{a.text}</Text>
              {done.includes(a.id)
                ? <Box display="flex" alignItems="center" minHeight="36px"><Badge color="positive" size="large" icon={CheckCircleIcon}>Approved by you</Badge></Box>
                : <Button variant={a.id === next ? 'primary' : 'secondary'} size="medium" isFullWidth isDisabled={!canApproveAction(actions, a.id, done)} onClick={() => approveAction(actions, issue.id, a.id)}>{a.button}</Button>}
            </Box>
          ))}
          <Text size="small" color="surface.text.gray.muted" marginTop="auto">Demo: approving changes this screen and the list only. Nothing is sent, refunded, held or cancelled.</Text>
        </Panel>
      </Pair>

      <Panel title="Affected customers" subtitle={issue.inferred ? `${n(c.affected)} carts seen, so the count above is an estimate · ${n(fixed)} covered` : `${n(c.affected)} found · ${n(fixed)} covered`} pad={false}>
        <Box padding="spacing.5">
          <SegmentedControl label="What happened to them" name="group" value={group} onChange={({ value }) => setPicked(value)}>
            {groups.map((g) => <SegmentedControlItem key={g.id} value={g.id}>{`${g.label} (${n(g.count)})`}</SegmentedControlItem>)}
          </SegmentedControl>
        </Box>
        <Table data={{ nodes: shown }} pagination={<TablePagination defaultPageSize={10} showPageSizePicker={false} />} gridTemplateColumns="minmax(150px, 1.4fr) minmax(140px, 1.2fr) minmax(110px, 1fr) minmax(240px, 2.2fr)" isHeaderSticky={false}>
          {(items) => (
            <>
              <TableHeader>
                <TableHeaderRow>
                  <TableHeaderCell>Customer</TableHeaderCell>
                  <TableHeaderCell>{issue.amount_label}</TableHeaderCell>
                  <TableHeaderCell>{before ? 'Left at' : 'Paid at'}</TableHeaderCell>
                  <TableHeaderCell>What happened</TableHeaderCell>
                </TableHeaderRow>
              </TableHeader>
              <TableBody>
                {items.map((x) => {
                  const g = groups.find((y) => y.id === x.group)!
                  return (
                    <TableRow key={x.id} item={x}>
                      <TableCell>{two(x.name, x.id)}</TableCell>
                      <TableCell>{two(rupees(x.amount_paise), x.detail)}</TableCell>
                      <TableCell>{two(clock(x.at), x.region)}</TableCell>
                      <TableCell>{two(g.what, g.note)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </>
          )}
        </Table>
      </Panel>
    </Box>
  )
}
