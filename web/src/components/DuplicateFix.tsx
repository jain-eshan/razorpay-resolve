import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Badge, Box, Button, Card, CardBody, Heading, ProgressBar, SegmentedControl, SegmentedControlItem, Text } from '@razorpay/blade/components'
import { Approved, Label, NextSteps, Turn } from './AgentAnswer'
import { SuccessMoment } from './SuccessMoment'
import { WhatsAppChat } from './WhatsAppChat'
import { demoNote } from '../lib/demo'
import { get, isLive, rupees, send, type Schemas } from '../lib/api'
import { when } from '../lib/format'

type Action = Schemas['Action']
type Board = Schemas['RefundBoard']
type Row = Schemas['RefundRow']
type AppHealth = { app_mode: string; healthy_hours: number; signal_healthy: boolean }

const SEND: Record<string, string> = { dry_run: 'Looks right, continue', first_5: 'Send the first 5', rest: 'Send the rest' }

// INC-2. Two things get fixed and neither is Blindspot's to do alone: the merchant's developer ships an app release that cannot double submit, and the founder
// refunds each second charge to the original payment method. A refund is approved one customer at a time, at every autonomy level, and cannot be undone.
export function DuplicateFix({ inc, onChanged }: { inc: Schemas['IncidentDetail']; onChanged: () => void }) {
  const nav = useNavigate()
  const [plan, setPlan] = useState<Action>()
  const [msg, setMsg] = useState<Action>()
  const [board, setBoard] = useState<Board>()
  const [previews, setPreviews] = useState<Schemas['MessagePreview'][]>([])
  const [hook, setHook] = useState<AppHealth>()
  const [result, setResult] = useState<Schemas['VerifyResult']>()
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(undefined)
    }
  }, [])

  const loadPreview = useCallback((a: Action) => get<Schemas['MessagePreview'][]>(`/api/messages/preview?action_id=${a.id}`).then(setPreviews), [])
  const refresh = useCallback(async () => {
    setBoard(await get<Board>(`/api/incidents/${inc.id}/refunds`))
    setHook(await get<AppHealth>('/merchant-mock/app-health'))
  }, [inc.id])

  useEffect(() => {
    get<Board>(`/api/incidents/${inc.id}/refunds`).then(setBoard).catch(() => undefined)
    get<AppHealth>('/merchant-mock/app-health').then(setHook).catch(() => undefined)
    for (const a of inc.actions) {
      get<Action>(`/api/actions/${a.id}`).then((full) => {
        if (full.action_type === 'refund') setPlan(full)
        if (full.action_type === 'message') {
          setMsg(full)
          loadPreview(full).catch(() => undefined)
        }
      })
    }
    if (inc.status === 'closed') send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`).then(setResult).catch(() => undefined)
  }, [inc.id, inc.actions, inc.status, loadPreview])

  const rows = board?.rows ?? []
  const total = rows.length
  const refunded = rows.filter((r) => r.state !== 'ready').length
  const next = rows.find((r) => r.state === 'ready')
  const processed = rows.filter((r) => r.state === 'processed').length
  const waiting = rows.filter((r) => r.state === 'processed' && !r.messaged).length
  const reviewed = !!plan && plan.status !== 'drafted'
  const language = (msg?.params as { language?: string } | undefined)?.language ?? 'auto'

  const approve = (a: Action, stage: Action['stage']) =>
    run(`${a.id}:${stage}`, async () => {
      const nextAction = await send<Action>('POST', `/api/actions/${a.id}/approve`, { stage, approver: 'founder' })
      if (nextAction.action_type === 'message') {
        setMsg(nextAction)
        await loadPreview(nextAction)
      } else {
        setPlan(nextAction)
      }
      await refresh()
      onChanged()
    })

  const refundOne = (r: Row) =>
    run(`refund:${r.payment_id}`, async () => {
      setPlan(await send<Action>('POST', `/api/actions/${plan!.id}/items/${r.payment_id}/approve`, { approver: 'founder' }))
      await refresh()
      onChanged()
    })

  const stageButton = (a: Action | undefined) =>
    a?.next_stage ? (
      <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
        {a.blocked_reason && <Text size="small" color="feedback.text.notice.intense">{a.blocked_reason}</Text>}
        <Button isLoading={busy === `${a.id}:${a.next_stage}`} isDisabled={!!a.blocked_reason || !!busy} onClick={() => approve(a, a.next_stage!)}>
          {a.next_stage === 'rest' ? `${SEND.rest} (${a.items.length - (a.item_counts.verified ?? 0)})` : SEND[a.next_stage]}
        </Button>
      </Box>
    ) : null

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="fix-panel">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="medium">What you can do</Heading>
        <Text size="small" color="surface.text.gray.muted">
          Refund each second charge to the customer's original payment method, and have your developer fix the Pay button. A refund is approved one customer at a time, at every autonomy level, and it cannot be undone. <Link to="/settings">Settings</Link>
        </Text>
      </Box>

      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Click through the steps. Each one is the engine's real answer. Refund the customers in the order shown.`} />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="That did not go through" description={error} />}

      <Turn n={1} analyzing={busy === 'plan' || busy?.startsWith(`${plan?.id}:`)} you={!plan ? undefined : reviewed ? 'Looks right, continue' : 'Plan the refunds'}
        title="Refund the second charge" badge={plan ? [plan.status === 'done' ? 'Done' : plan.status === 'drafted' ? 'Waiting for you' : `${refunded} of ${total}`, plan.status === 'done' ? 'positive' : 'notice'] : undefined}>
        {!plan ? (
          <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
            <Text size="small">Lists the {inc.tier_counts.exact} customers charged twice and what each would get back. Each refund goes to the original payment method, in full. The two seats bought for two people, and the second attempts the bank reverses by itself, are left out. Changes nothing yet.</Text>
            <Button isLoading={busy === 'plan'} isDisabled={!!busy} onClick={() => run('plan', async () => { setPlan(await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'refund', params: {} })); setResult(undefined); await refresh(); onChanged() })}>
              Plan the refunds
            </Button>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.4">
            <Text weight="semibold">{total} customers, {rupees(board ? board.owed_paise + board.refunded_paise : 0)} to go back to their original payment methods.</Text>
            <Text size="small" color="surface.text.gray.muted">Today's limit is {rupees(board?.cap_paise ?? 0)}. {rupees(board?.spent_today_paise ?? 0)} is refunded so far today. A refund cannot be undone.</Text>
            {!reviewed && <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
              <Text size="small">Looks right? Then approve the list. After that each customer has their own Refund button. Nothing is refunded by approving the list.</Text>
              <Button isLoading={busy === `${plan.id}:dry_run`} isDisabled={!!busy} onClick={() => approve(plan, 'dry_run')}>Looks right, continue</Button>
            </Box>}
            {reviewed && <Approved>Dry run approved</Approved>}
            {reviewed && <ProgressBar label="Refunded" value={total ? Math.round((refunded / total) * 100) : 0} />}
            {reviewed && refunded < total && <Text size="small" weight="semibold">Each Refund button sends that customer's refund now. It cannot be undone.</Text>}
            <Box display="flex" flexDirection="column">
              {rows.map((r) => (
                <Box key={r.payment_id} display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', m: 'center' }} gap={{ base: 'spacing.3', m: 'spacing.5' }}
                  paddingY="spacing.3" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle" testID="refund-row">
                  <Box display="flex" flexDirection="column" flex="1" minWidth="0px">
                    <Text weight="semibold">{r.customer_masked} · {rupees(r.amount_paise)}{r.complained ? ' · wrote in' : ''}</Text>
                    <Text size="small" color="surface.text.gray.muted">
                      Charged twice {r.gap_seconds} seconds apart on {when(r.charged_at)} · {r.method === 'upi' ? 'UPI' : r.method}
                    </Text>
                  </Box>
                  {r.state === 'ready' ? (
                    <Button variant="secondary" size="small" isLoading={busy === `refund:${r.payment_id}`} isDisabled={!reviewed || !!busy || (!isLive && r !== next)} onClick={() => refundOne(r)}>
                      {`Refund ${rupees(r.amount_paise)}`}
                    </Button>
                  ) : (
                    <Box display="flex" flexDirection="column" alignItems={{ base: 'flex-start', m: 'flex-end' }} gap="spacing.1">
                      <Badge size="medium" color={r.state === 'processed' ? 'positive' : 'notice'}>{r.state === 'processed' ? 'Processed' : 'Pending'}</Badge>
                      <Text size="small" color="surface.text.gray.muted">{r.state === 'processed' ? `${r.ref_format} ${r.ref}` : `Refund ${r.refund_id}`}</Text>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
            {!isLive && reviewed && refunded < total && <Text size="small" color="surface.text.gray.muted">In the hosted demo, refund the customers in the order shown. The live version lets you pick anyone.</Text>}
            {reviewed && refunded === total && <Approved>{`${total} refunds started`}</Approved>}
          </Box>
        )}
      </Turn>

      {refunded > 0 && (
        <Turn n={2} analyzing={busy === 'msgplan'} you="Tell the customers" title="Tell the customers" badge={msg ? [msg.status === 'done' ? 'Sent' : msg.status === 'drafted' ? 'Draft' : 'In progress', msg.status === 'done' ? 'positive' : 'neutral'] : undefined}>
          {!msg ? (
            <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
              <Text size="small">One message to each customer with their refund id and the bank reference to quote if it does not show up. A refund gets its bank reference after the bank has processed it: a couple of hours for UPI, longer for netbanking and cards. {processed} of {total} have one so far.</Text>
              <Button variant="secondary" isLoading={busy === 'msgplan'} isDisabled={!!busy} onClick={() => run('msgplan', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'message', params: { language: 'auto' } }); setMsg(a); await loadPreview(a) })}>
                Preview the message
              </Button>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap="spacing.4">
              {msg.status === 'drafted' && (
                <SegmentedControl label="Language" name="lang" value={language} onChange={({ value }) => run('lang', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'message', params: { language: value } }); setMsg(a); await loadPreview(a) })}>
                  <SegmentedControlItem value="auto">Each customer's language</SegmentedControlItem>
                  <SegmentedControlItem value="en">English</SegmentedControlItem>
                  <SegmentedControlItem value="hi_latn">Hinglish</SegmentedControlItem>
                </SegmentedControl>
              )}
              <Label>Nothing is sent without your approval</Label>
              <Heading size="medium">Send this to {msg.items.length} customers on WhatsApp?</Heading>
              <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 280px), 1fr))" gap="spacing.5" justifyItems="center">
                {previews.slice(0, 2).map((p) => (
                  <Box key={p.template_id + p.language} display="flex" flexDirection="column" gap="spacing.3" width="100%" alignItems="center">
                    <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap" justifyContent="center">
                      <Badge color="neutral">{p.category}</Badge>
                      <Text size="small" color="surface.text.gray.muted">From {p.sender} · to {p.recipients} customers · {p.language === 'en' ? 'English' : 'Hinglish'}</Text>
                    </Box>
                    <WhatsAppChat name={p.sender} compact messages={[{ from: 'business', text: p.body }]} />
                  </Box>
                ))}
              </Box>
              <Alert isFullWidth color="positive" isDismissible={false} title="Written from an approved template" description="The refund id, the bank reference and the amount come from Razorpay's refund record. No link, no promise beyond what the record says." />
              <Text size="small" color="surface.text.gray.muted">Messages cannot be unsent.</Text>
              {msg.blocked_reason?.startsWith('Messaging') && (
                <Button variant="secondary" isDisabled={!!busy} onClick={() => run('msgon', async () => { const s = await get<Schemas['Settings']>('/api/settings'); await send('PUT', '/api/settings', { ...s, messaging_enabled: true }); setMsg(await get<Action>(`/api/actions/${msg.id}`)) })}>
                  Switch messaging on
                </Button>
              )}
              {stageButton(msg)}
              {msg.status === 'done' && waiting > 0 && (
                <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
                  <Text size="small">{waiting} more customers now have a bank reference.</Text>
                  <Button variant="secondary" isDisabled={!!busy} onClick={() => run('topup', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'message', params: { language } }); setMsg(a); await loadPreview(a) })}>
                    {`Add ${waiting} more customers`}
                  </Button>
                </Box>
              )}
              {msg.status === 'done' && waiting === 0 && <Approved>{`Sent to ${msg.items.length} customers`}</Approved>}
            </Box>
          )}
        </Turn>
      )}

      {(refunded > 0 || inc.status === 'closed') && (
        <Turn n={refunded > 0 ? 3 : 2} analyzing={busy === 'verify'} you={result ? 'Verify and close' : undefined} title="Verify and close" badge={inc.status === 'closed' ? ['Closed', 'positive'] : undefined}>
          <Text size="small">Checks every refund against Razorpay's refund records again, and that the fixed app has run for 24 hours with no new double charge.</Text>
          <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
            <Button variant="secondary" isLoading={busy === 'verify'} isDisabled={!plan || !!busy} onClick={() => run('verify', async () => { setResult(await send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`)); await refresh(); onChanged() })}>
              Verify and close
            </Button>
            {result && <Text weight="semibold" color={result.closeable ? 'feedback.text.positive.intense' : 'feedback.text.notice.intense'}>{result.line}</Text>}
          </Box>
          {result?.closeable && inc.status === 'closed' && <SuccessMoment heading={`${result.verified} customers got their money back`} detail={`${rupees(result.restored_paise)} returned. This incident is closed.`} />}
        </Turn>
      )}

      {result?.closeable && inc.status === 'closed' && <NextSteps next={[{ label: 'Open the audit log', onClick: () => nav('/audit') }, { label: 'See all incidents', onClick: () => nav('/incidents') }, { label: 'Run the Day-0 scan', onClick: () => nav('/scan') }]} />}

      <Card>
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Box display="flex" gap="spacing.3" alignItems="center">
              <Heading size="small">Demo controls</Heading>
              <Badge color="neutral">Simulated merchant</Badge>
            </Box>
            <Text size="small" color="surface.text.gray.muted">
              Your developer, the bank and the clock are simulated here. {hook ? `Android app: ${hook.app_mode === 'fixed' ? `fixed release out for ${hook.healthy_hours} h` : 'still lets the Pay button be tapped twice'}.` : ''} Banks take time: UPI refunds are processed in about 2 hours, netbanking in 24, cards in 72.
            </Text>
            <Box display="flex" gap="spacing.4" flexWrap="wrap">
              <Button variant="secondary" size="small" isDisabled={!!busy || hook?.app_mode === 'fixed'} onClick={() => run('fix', async () => { setHook(await send<AppHealth>('POST', '/merchant-mock/app-mode', { mode: 'fixed' })) })}>
                Your developer ships the fix
              </Button>
              {[3, 24, 72].map((h) => (
                <Button key={h} variant="secondary" size="small" isDisabled={!!busy} onClick={() => run('clock', async () => { await send('POST', '/api/clock/advance', { hours: h, incident: inc.id }); await refresh(); onChanged() })}>
                  {`Move the clock forward ${h} hours`}
                </Button>
              ))}
            </Box>
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}
