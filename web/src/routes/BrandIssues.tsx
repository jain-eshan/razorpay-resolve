import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { AlertTriangleIcon, Alert, Badge, Box, Button, RupeesIcon, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text, UsersIcon } from '@razorpay/blade/components'
import { PageHeader } from '../components/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { Stat } from '../components/Stat'
import { rupees } from '../lib/api'
import { BRAND, startAgain, STEPS, useAllIssueApproved, useApproved, useBrandIssues, useJ2 } from '../lib/brand'
import { OWNER, ZONE, ZONE_LINE, when } from '../lib/format'

// The brand's Payment issues (J2 and the four in `issues.json`): the same list as Kaksha's, with the app 8.2 story from the four screens as one row and the other four beside it. Each
// row opens its own issue page. The status comes from the approvals made on those pages (lib/brand.ts), so an issue closed there reads Closed here.
type Line = {
  id: string; to: string; title: string; sub: string; owner: keyof typeof OWNER; estimated: boolean; closed: boolean; zone: 'before' | 'after'
  affected: number; second: string; paise: number; note: string; started: string; done: string
}
const n = (x: number) => x.toLocaleString('en-IN')
const TONE = { bank: 'neutral', razorpay: 'neutral', merchant_code: 'notice', merchant_config: 'notice' } as const

function Title({ to, title }: { to: string; title: string }) {
  return <RouterLink to={to} style={{ textDecoration: 'none' }}><Text weight="semibold" color="interactive.text.primary.normal">{title}</Text></RouterLink>
}

export default function BrandIssues() {
  const nav = useNavigate()
  const { data: j2, error: e1 } = useJ2()
  const { data: issues, error: e2 } = useBrandIssues()
  const steps = useApproved()
  const approved = useAllIssueApproved()
  const error = e1 ?? e2
  if (error) return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="Payment issues" />
      <Alert isFullWidth color="negative" isDismissible={false} title="The demo data did not load" description={`${error}. Reload the page. If it keeps failing, run "uv run python -m synth.j2_brand" and "uv run python -m synth.brand_issues" and reload.`} />
    </Box>
  )
  if (!j2 || !issues) return <PageSkeleton />

  const lines: Line[] = [
    {
      id: 'j2', to: '/demo/incident', title: `${n(j2.counts.affected)} customers paid by UPI and saw “Payment failed”`, sub: `${j2.platform} app ${j2.app_version} skips the verify-payment call after UPI`,
      owner: 'merchant_code', estimated: false, closed: STEPS.every((s) => steps.includes(s)), zone: 'after', affected: j2.counts.affected, second: `${n(j2.counts.paid_twice)} paid twice`,
      paise: j2.money_paise.stuck, note: 'paid, no order confirmed', started: j2.timeline.rollout, done: 'Closed',
    },
    ...issues.map((i): Line => ({
      id: i.id, to: `/demo/issues/${i.id}`, title: i.headline, sub: i.short, owner: i.owner, estimated: i.inferred, closed: i.actions.every((a) => (approved[i.id] ?? []).includes(a.id)), zone: i.zone,
      affected: i.counts.affected, second: `${n(i.counts.complained)} complained`, paise: i.money_paise, note: i.money_hint, started: i.started_at, done: 'Approved',
    })),
  ]
  const open = lines.filter((l) => !l.closed)
  const estimated = lines.filter((l) => l.estimated)
  const estPaise = estimated.reduce((a, l) => a + l.paise, 0)
  const estCount = estimated.reduce((a, l) => a + l.affected, 0)
  const cause = (l: Line) => `${OWNER[l.owner]}${l.estimated ? ' · estimated' : ''}`

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader title="Payment issues" description={`What Blindspot found for ${BRAND}, biggest first. Each one shows who was hit, the amount involved and whose side the cause is on.`}
        actions={<><Button variant="tertiary" size="medium" onClick={() => { startAgain(); nav('/demo/store') }}>Replay the app 8.2 story</Button><Button variant="tertiary" size="medium" onClick={() => nav('/incidents')}>Leave the demo</Button></>} />
      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
        <Stat label="Open issues" value={String(open.length)} hint={`of ${lines.length} found`} icon={AlertTriangleIcon} tone="notice" />
        <Stat label="Amount involved" value={rupees(lines.reduce((a, l) => a + l.paise, 0))} hint={`about ${rupees(estPaise)} of it estimated`} icon={RupeesIcon} />
        <Stat label="Customers affected" value={n(lines.reduce((a, l) => a + l.affected, 0))} hint={`about ${n(estCount)} of them estimated`} icon={UsersIcon} />
      </Box>
      {(['before', 'after'] as const).map((zone) => {
        const items = lines.filter((l) => l.zone === zone).sort((a, b) => b.paise - a.paise)
        return (
          <Panel key={zone} title={ZONE[zone]} subtitle={ZONE_LINE[zone]} pad={false} trailing={<Badge color="neutral" size="medium">{`${items.length} found`}</Badge>}>
            <Box display={{ base: 'none', l: 'block' }}>
              <Table data={{ nodes: items }} gridTemplateColumns="minmax(240px, 2.4fr) minmax(170px, 1.4fr) minmax(80px, 0.7fr) minmax(100px, 0.9fr) minmax(140px, 1.2fr) minmax(150px, 1.2fr)" isHeaderSticky={false}>
                {(rows) => (
                  <>
                    <TableHeader>
                      <TableHeaderRow>
                        <TableHeaderCell>Issue</TableHeaderCell>
                        <TableHeaderCell>Cause</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Customers</TableHeaderCell>
                        <TableHeaderCell>Amount</TableHeaderCell>
                        <TableHeaderCell>Started</TableHeaderCell>
                      </TableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((l) => (
                        <TableRow key={l.id} item={l}>
                          <TableCell><Box display="flex" flexDirection="column" paddingY="spacing.3"><Title to={l.to} title={l.title} /><Text size="small" color="surface.text.gray.muted">{l.sub}</Text></Box></TableCell>
                          <TableCell><Badge size="medium" color={TONE[l.owner as keyof typeof TONE] ?? 'neutral'}>{cause(l)}</Badge></TableCell>
                          <TableCell><Badge size="medium" color={l.closed ? 'positive' : 'notice'}>{l.closed ? l.done : 'Open'}</Badge></TableCell>
                          <TableCell><Box display="flex" flexDirection="column"><Text weight="semibold" color="surface.text.gray.subtle">{`${l.estimated ? 'About ' : ''}${n(l.affected)}`}</Text><Text size="small" color="surface.text.gray.muted">{l.second}</Text></Box></TableCell>
                          <TableCell><Box display="flex" flexDirection="column"><Text>{rupees(l.paise)}</Text><Text size="small" color="surface.text.gray.muted">{l.note}</Text></Box></TableCell>
                          <TableCell><Text>{when(l.started)}</Text></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
            </Box>
            {/* Below l: one card per issue, so the figures are not pushed off the side of a table. */}
            <Box display={{ base: 'block', l: 'none' }}>
              {items.map((l) => (
                <Box key={l.id} padding="spacing.5" display="flex" flexDirection="column" gap="spacing.2" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Title to={l.to} title={l.title} />
                  <Text size="small" color="surface.text.gray.muted">{l.sub}</Text>
                  <Box display="flex" gap="spacing.2" flexWrap="wrap">
                    <Badge size="small" color={TONE[l.owner as keyof typeof TONE] ?? 'neutral'}>{cause(l)}</Badge>
                    <Badge size="small" color={l.closed ? 'positive' : 'notice'}>{l.closed ? l.done : 'Open'}</Badge>
                  </Box>
                  <Text weight="semibold" color="surface.text.gray.subtle">{`${l.estimated ? 'About ' : ''}${n(l.affected)} customers · ${rupees(l.paise)} ${l.note}`}</Text>
                  <Text size="small" color="surface.text.gray.muted">{`Started ${when(l.started)} · ${l.second}`}</Text>
                </Box>
              ))}
            </Box>
          </Panel>
        )
      })}
      <Text size="small" color="surface.text.gray.muted">{`${ZONE.during}: a payment that fails at the bank or the UPI app is on Razorpay's Success Rate page, so Blindspot leaves it out. An issue where the bank took the money and the order was left waiting is after payment, so it is listed.`}</Text>
    </Box>
  )
}
