import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Badge, Box, Button, Card, CardBody, Heading, ProgressBar, SegmentedControl, SegmentedControlItem, Text } from '@razorpay/blade/components'
import { SuccessMoment } from './SuccessMoment'
import { NextSteps, Turn } from './AgentAnswer'
import { demoNote } from '../lib/demo'
import { get, isLive, rupees, send, type Schemas } from '../lib/api'

type Action = Schemas['Action']
type Hook = { webhook_mode: string; healthy_hours: number; signal_healthy: boolean }

const LEVEL = { suggest: 'Suggest', assist: 'Assist', autopilot_reversible: 'Autopilot' } as const
const LEVEL_NOTE = {
  suggest: 'You approve every step.',
  assist: 'You approve the dry run once. The first 5 and the rest then run by themselves, and stop if anything fails.',
  autopilot_reversible: 'Steps run by themselves within your limits, and can be undone.',
}
const BUTTON: Record<string, string> = { dry_run: 'Looks right, continue', first_5: 'Grant the first 5', rest: 'Grant the rest' }

export function FixPanel({ inc, members, onChanged }: { inc: Schemas['IncidentDetail']; members: Schemas['Member'][]; onChanged: () => void }) {
  const nav = useNavigate()
  const [grant, setGrant] = useState<Action>()
  const [msg, setMsg] = useState<Action>()
  const [previews, setPreviews] = useState<Schemas['MessagePreview'][]>([])
  const [hook, setHook] = useState<Hook>()
  const [tested, setTested] = useState(false)
  const [result, setResult] = useState<Schemas['VerifyResult']>()
  const [level, setLevel] = useState<keyof typeof LEVEL>('suggest')
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const byPayment = new Map(members.map((m) => [m.payment_id, m]))

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
  const refreshHook = useCallback(() => get<Hook>('/merchant-mock/health').then(setHook), [])

  useEffect(() => {
    refreshHook().catch(() => undefined)
    get<Schemas['Settings']>('/api/settings').then((s) => setLevel(s.autonomy ?? 'suggest')).catch(() => undefined)
    for (const a of inc.actions) {
      get<Action>(`/api/actions/${a.id}`).then((full) => {
        if (full.action_type === 'grant') setGrant(full)
        if (full.action_type === 'message') {
          setMsg(full)
          loadPreview(full).catch(() => undefined)
        }
      })
    }
    if (inc.status === 'closed') send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`).then(setResult).catch(() => undefined)
  }, [inc.id, inc.actions, inc.status, loadPreview, refreshHook])

  const done = (grant?.item_counts.verified ?? 0)
  const total = grant?.items.length ?? 0
  const exactRows = (grant?.items ?? []).map((i) => byPayment.get(i.payment_id)).filter((m): m is Schemas['Member'] => !!m)
  const restoredPaise = result?.restored_paise ?? 0
  const messagesSent = (msg?.item_counts.verified ?? 0) > 0
  const canUndo = !!grant && ['approved', 'done', 'failed'].includes(grant.status) && !messagesSent

  const approve = (a: Action, set: (x: Action) => void, stage: Action['stage']) =>
    run(`${a.id}:${stage}`, async () => {
      const next = await send<Action>('POST', `/api/actions/${a.id}/approve`, { stage, approver: 'founder' })
      set(next)
      if (next.action_type === 'message') await loadPreview(next)
      onChanged()
    })

  const stageButton = (a: Action | undefined, set: (x: Action) => void) =>
    a?.next_stage ? (
      <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
        {a.blocked_reason && <Text size="small" color="feedback.text.notice.intense">{a.blocked_reason}</Text>}
        <Button isLoading={busy === `${a.id}:${a.next_stage}`} isDisabled={!!a.blocked_reason || !!busy} onClick={() => approve(a, set, a.next_stage!)}>
          {a.next_stage === 'rest' ? `${BUTTON.rest} (${a.items.length - (a.item_counts.verified ?? 0)})` : a.status === 'failed' ? 'Retry' : BUTTON[a.next_stage]}
        </Button>
      </Box>
    ) : null

  const language = (msg?.params as { language?: string } | undefined)?.language ?? 'auto'

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="fix-panel">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="medium">Fix it</Heading>
        <Text size="small" color="surface.text.gray.muted">
          Autonomy: {LEVEL[level]}. {LEVEL_NOTE[level]} <Link to="/settings">Change it</Link>
        </Text>
      </Box>

      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Click through the steps. Each one is the engine's real answer.`} />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="That did not go through" description={error} />}

      <Turn n={1} analyzing={busy === 'test'} title="Test your access hook" badge={tested ? ['Reachable', 'positive'] : grant ? ['Skipped, plan already exists', 'neutral'] : undefined}>
        <Text size="small">Before anything changes, check that your side answers. Blindspot only switches access on through this hook. It cannot switch it off.</Text>
        <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
          <Button variant="secondary" isLoading={busy === 'test'} isDisabled={!!busy} onClick={() => run('test', async () => { await refreshHook(); setTested(true) })}>Test hook</Button>
          {tested && hook && <Text size="small">Your hook answered. Your webhook {hook.webhook_mode === 'ok' ? 'is answering normally' : `is returning ${hook.webhook_mode}`}.</Text>}
        </Box>
      </Turn>

      {(tested || !!grant) && (
        <Turn n={2} analyzing={busy === 'plan'} you={'Test hook'} title="Dry run" badge={grant && grant.status !== 'reverted' ? [grant.status === 'drafted' ? 'Waiting for you' : 'Reviewed', grant.status === 'drafted' ? 'notice' : 'positive'] : undefined}>
        {!grant || grant.status === 'reverted' ? (
          <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
            <Text size="small">Lists who would be switched on. Changes nothing.</Text>
            <Button isLoading={busy === 'plan'} isDisabled={!tested || !!busy} onClick={() => run('plan', async () => { setGrant(await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'grant', params: {} })); onChanged() })}>
              Plan the fix
            </Button>
            {!tested && <Text size="small" color="surface.text.gray.muted">Test your hook first.</Text>}
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Text weight="semibold">{total} customers, {rupees(exactRows.reduce((a, m) => a + m.amount_paise, 0))}. {grant.status === 'drafted' ? 'All paid, none have access in your records.' : 'All paid. None had access before this fix.'}</Text>
            {exactRows.slice(0, 5).map((m) => (
              <Text key={m.payment_id} size="small">{m.customer_masked} · {m.plan} · {rupees(m.amount_paise)}{grant.status === 'drafted' ? ` · your records: ${m.merchant_state}` : ''}{m.complained ? ' · complained' : ''}</Text>
            ))}
            {total > 5 && <Text size="small" color="surface.text.gray.muted">and {total - 5} more</Text>}
            {grant.status === 'drafted' && stageButton(grant, setGrant)}
          </Box>
        )}
      </Turn>
      )}

      {!!grant && grant.status !== 'drafted' && (
        <Turn n={3} analyzing={busy === 'undo' || busy === `${grant.id}:${grant.next_stage}`} you={grant.status === 'reverted' ? 'Undo the grants' : 'Looks right, continue'} title="Switch access on, 5 then the rest" badge={grant.status !== 'reverted' ? [grant.status === 'done' ? 'Done' : grant.status === 'failed' ? 'Stopped' : `${done} of ${total}`, grant.status === 'done' ? 'positive' : grant.status === 'failed' ? 'negative' : 'notice'] : undefined}>
        {grant.status === 'reverted' ? (
          <Text size="small">Undone. Every record is back to how it was. Plan again whenever you are ready.</Text>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <ProgressBar label="Confirmed by your records" value={total ? Math.round((done / total) * 100) : 0} />
            <Text size="small">{done} of {total} confirmed active by your records after each change.</Text>
            {stageButton(grant, setGrant)}
            {canUndo && (
              <Box>
                <Button variant="tertiary" size="small" isDisabled={!!busy} onClick={() => run('undo', async () => { setGrant(await send<Action>('POST', `/api/actions/${grant.id}/revert`)); setResult(undefined); onChanged() })}>
                  Undo these changes
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Turn>
      )}

      {done > 0 && (
        <Turn n={4} analyzing={busy === 'msgplan'} you={'Tell the customers'} title="Tell customers" badge={msg ? [msg.status === 'done' ? 'Sent' : msg.status === 'drafted' ? 'Draft' : 'In progress', msg.status === 'done' ? 'positive' : 'neutral'] : undefined}>
        {done === 0 ? (
          <Text size="small" color="surface.text.gray.muted">Opens once access is confirmed for at least one customer, because the message says access is on.</Text>
        ) : !msg ? (
          <Button variant="secondary" isLoading={busy === 'msgplan'} isDisabled={!!busy} onClick={() => run('msgplan', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'message', params: { language: 'auto' } }); setMsg(a); await loadPreview(a) })}>
            Preview the message
          </Button>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.4">
            {msg.status === 'drafted' && (
              <SegmentedControl label="Language" name="lang" value={language} onChange={({ value }) => run('lang', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'message', params: { language: value } }); setMsg(a); await loadPreview(a) })}>
                <SegmentedControlItem value="auto">Each customer's language</SegmentedControlItem>
                <SegmentedControlItem value="en">English</SegmentedControlItem>
                <SegmentedControlItem value="hi_latn">Hinglish</SegmentedControlItem>
              </SegmentedControl>
            )}
            {previews.map((p) => (
              <Box key={p.template_id + p.language} backgroundColor="surface.background.gray.subtle" borderRadius="medium" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.3">
                <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                  <Badge color="neutral">{p.category}</Badge>
                  <Text size="small" color="surface.text.gray.muted">From {p.sender} · to {p.recipients} customers · {p.language === 'en' ? 'English' : 'Hinglish'}</Text>
                </Box>
                <Text>{p.body}</Text>
              </Box>
            ))}
            <Text size="small" color="surface.text.gray.muted">Written from a template. Amounts, dates and references come from each customer's own payment. No link, no discount. Messages cannot be unsent, and once they go out the grants can no longer be undone.</Text>
            {msg.blocked_reason?.startsWith('Messaging') && (
              <Button variant="secondary" isDisabled={!!busy} onClick={() => run('msgon', async () => { const s = await get<Schemas['Settings']>('/api/settings'); await send('PUT', '/api/settings', { ...s, messaging_enabled: true }); setMsg(await get<Action>(`/api/actions/${msg.id}`)) })}>
                Switch messaging on
              </Button>
            )}
            {stageButton(msg, setMsg)}
          </Box>
        )}
      </Turn>
      )}

      {(done > 0 || inc.status === 'closed') && (
        <Turn n={5} analyzing={busy === 'verify'} you={result ? 'Verify and close' : undefined} title="Verify and close" badge={inc.status === 'closed' ? ['Closed', 'positive'] : undefined}>
        <Text size="small">Checks every restored customer against your records again, and that your webhook has answered normally for 24 hours.</Text>
        <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
          <Button variant="secondary" isLoading={busy === 'verify'} isDisabled={!grant || !!busy} onClick={() => run('verify', async () => { setResult(await send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`)); await refreshHook(); onChanged() })}>
            Verify and close
          </Button>
          {result && <Text weight="semibold" color={result.closeable ? 'feedback.text.positive.intense' : 'feedback.text.notice.intense'}>{result.line}</Text>}
        </Box>
        {result?.closeable && inc.status === 'closed' && <SuccessMoment heading={`${result.verified} customers have access again`} detail={`${rupees(restoredPaise)} restored. This incident is closed.`} />}
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
              Your developer and the clock are simulated here. {hook ? `Webhook: ${hook.webhook_mode === 'ok' ? `answering normally for ${hook.healthy_hours} h` : `returning ${hook.webhook_mode}`}.` : ''}
            </Text>
            <Box display="flex" gap="spacing.4" flexWrap="wrap">
              <Button variant="secondary" size="small" isDisabled={!!busy || hook?.webhook_mode === 'ok'} onClick={() => run('fix', async () => { setHook(await send<Hook>('POST', '/merchant-mock/webhook-mode', { mode: 'ok' })) })}>
                Your developer ships the fix
              </Button>
              <Button variant="secondary" size="small" isDisabled={!!busy} onClick={() => run('clock', async () => { await send('POST', '/api/clock/advance', { hours: 24 }); await refreshHook() })}>
                Move the clock forward 24 hours
              </Button>
            </Box>
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}
