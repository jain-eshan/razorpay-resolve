import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Badge, Box, Button, Card, CardBody, Heading, Text } from '@razorpay/blade/components'
import { SuccessMoment } from './SuccessMoment'
import { NextSteps, Turn } from './AgentAnswer'
import { demoNote } from '../lib/demo'
import { get, isLive, rupees, send, type Schemas } from '../lib/api'

type Action = Schemas['Action']
type Health = { page_mode: string; page_status: number; healthy_hours: number; signal_healthy: boolean }

const BUTTON: Record<string, string> = { dry_run: 'Looks right, continue', first_5: 'Send the first 5', rest: 'Send the rest' }
const NEED_HOURS = 2

// Hero B. The cause is on the merchant's side and Blindspot only infers it, so the fix is the developer's. What Blindspot does here is
// check the fix held, then offer the customers who could not pay a link, in stages, with a few held back to measure what the link adds.
export function Zone1Fix({ inc, onChanged }: { inc: Schemas['IncidentDetail']; onChanged: () => void }) {
  const nav = useNavigate()
  const kind = String((inc.verdict.signature as { kind?: string }).kind ?? 'probe')
  const [health, setHealth] = useState<Health>()
  const [probe, setProbe] = useState<Schemas['ProbeResult']>()
  const [rec, setRec] = useState<Action>()
  const [previews, setPreviews] = useState<Schemas['MessagePreview'][]>([])
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
  const refreshHealth = useCallback(() => (kind === 'probe' ? get<Health>('/merchant-mock/page-health').then(setHealth) : Promise.resolve()), [kind])

  useEffect(() => {
    refreshHealth().catch(() => undefined)
    for (const a of inc.actions) {
      if (a.action_type === 'recovery_link') {
        get<Action>(`/api/actions/${a.id}`).then((full) => {
          setRec(full)
          loadPreview(full).catch(() => undefined)
        })
      }
    }
    if (inc.status === 'closed') send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`).then(setResult).catch(() => undefined)
  }, [inc.id, inc.actions, inc.status, loadPreview, refreshHealth])

  const c = rec?.item_counts ?? {}
  const holdout = ((rec?.params as { holdout?: string[] } | undefined)?.holdout ?? []).length
  const planned = rec?.items.length ?? 0
  const sent = c.sent ?? 0
  // Links go out only once the pay page has answered normally for 2 hours (the engine's own gate at approval). Until then the button to plan them is locked and says why,
  // instead of making a draft that cannot be sent. A checkout issue has no page check: the engine confirms it from the orders, so nothing is locked here.
  const locked = kind !== 'probe' ? undefined
    : !health ? 'Checking your pay page.'
    : health.page_mode !== 'ok' ? `Fix your pay page first, then wait for ${NEED_HOURS} hours of healthy checks.`
    : !health.signal_healthy ? `Your pay page has answered normally for ${health.healthy_hours} of ${NEED_HOURS} hours. Links unlock after ${NEED_HOURS} hours.`
    : undefined
  const approve = (a: Action, stage: Action['stage']) =>
    run(`${a.id}:${stage}`, async () => {
      const next = await send<Action>('POST', `/api/actions/${a.id}/approve`, { stage, approver: 'founder' })
      setRec(next)
      await loadPreview(next)
      onChanged()
    })

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="fix-panel">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading as="h2" size="medium">Fix it</Heading>
        <Text size="small" color="surface.text.gray.muted">
          This is estimated, not seen by Razorpay, so Blindspot never changes your site or moves money. Payment links always wait for your approval, at every approval level.{' '}
          <Link to="/settings">Settings</Link>
        </Text>
      </Box>

      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Demo" description={`${demoNote} Click through the steps. Each answer comes from the real engine.`} />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="That did not go through" description={error} />}

      {/* The developer gets the evidence from "Send to your developer" in the actions card above, the one place on the page that offers it. */}
      <Turn n={1} analyzing={busy === 'probe'} you={probe ? 'Check the pay page now' : undefined} title={kind === 'probe' ? 'Confirm your pay page works again' : 'Confirm checkout works again'} badge={health?.signal_healthy ? ['Healthy', 'positive'] : health ? [health.page_mode === 'ok' ? `Healthy ${health.healthy_hours} of ${NEED_HOURS} h` : `Answers ${health.page_status}`, health.page_mode === 'ok' ? 'notice' : 'negative'] : undefined}>
        {kind === 'probe' ? (
          <>
            <Text size="small">Your developer fixes the page. Blindspot opens your pay page every 5 minutes, and two failed checks in a row raised this issue. Payment links go out only after the page has answered normally for {NEED_HOURS} hours.</Text>
            <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
              <Button variant="secondary" isLoading={busy === 'probe'} isDisabled={!!busy} onClick={() => run('probe', async () => { setProbe(await send<Schemas['ProbeResult']>('POST', '/api/probes/run')); await refreshHealth() })}>
                Check the pay page now
              </Button>
              {probe && <Text weight="semibold" color={probe.ok ? 'feedback.text.positive.intense' : 'feedback.text.negative.intense'}>HTTP {probe.http_status}{probe.checkout_script_present ? '' : ', no checkout script'}. {probe.ok ? 'The page answers normally.' : 'The page is still failing.'}</Text>}
            </Box>
          </>
        ) : (
          <Text size="small">A page check cannot see a checkout that will not open, because the page itself loads. Blindspot confirms the fix from the orders that came after: at least 3 of them got a payment attempt.</Text>
        )}
      </Turn>

      <Turn n={2} analyzing={busy === 'plan'} you={rec ? 'Plan the links' : undefined} title="Send customers a link to pay again" badge={rec ? [rec.status === 'done' ? 'Sent' : rec.status === 'drafted' ? 'Draft, nothing sent' : rec.status === 'failed' ? 'Stopped' : `${sent} of ${planned - holdout}`, rec.status === 'done' ? 'positive' : rec.status === 'failed' ? 'negative' : 'neutral'] : locked ? ['Locked', 'neutral'] : undefined}>
        {!rec ? (
          <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
            <Text size="small">Each customer who wrote in and could not pay gets a link for the same plan and amount, on the channel they used. Planning lists who gets one and sends nothing.</Text>
            <Button isLoading={busy === 'plan'} isDisabled={!!busy || !!locked} onClick={() => run('plan', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'recovery_link', params: {} }); setRec(a); await loadPreview(a); onChanged() })}>
              Plan the links
            </Button>
            {locked && <Text size="small" color="feedback.text.notice.intense" testID="links-locked">{locked}</Text>}
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.4">
            <Text weight="semibold">{planned} customers, {holdout} of them held back on purpose.</Text>
            {rec.status === 'drafted' && <Text size="small">The plan is ready and nothing has been sent. Read the message below, then approve the test run.</Text>}
            <Text size="small" color="surface.text.gray.muted">The held-back customers get nothing. Comparing them with the rest is the only way to tell what the link adds. With so few customers the comparison is a rough guide at best.</Text>
            {previews.map((p) => (
              <Box key={p.template_id + p.language} backgroundColor="surface.background.gray.subtle" borderRadius="medium" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.3">
                <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                  <Badge color="neutral">{p.category.replace('_', ' ')}</Badge>
                  <Text size="small" color="surface.text.gray.muted">From {p.sender} · to {p.recipients} customers · {p.language === 'en' ? 'English' : 'Hinglish'}</Text>
                </Box>
                <Text>{p.body}</Text>
                <Box><Badge color="information" size="medium">Button: Pay the same amount</Badge></Box>
              </Box>
            ))}
            <Text size="small" color="surface.text.gray.muted">Written from a template. The link is made through Razorpay's payment link API (simulated here), valid for {String((rec.params as { valid_hours?: number }).valid_hours ?? 48)} hours, no discount, one per customer. Messages cannot be unsent.</Text>
            {/* Whatever holds the links back is said in words, with the way to clear it, so the disabled button below never looks broken. */}
            {rec.blocked_reason && <Alert isFullWidth color="notice" isDismissible={false} title="Not sent yet" description={rec.blocked_reason} />}
            {rec.blocked_reason?.startsWith('Messaging') && (
              <Box>
                <Button variant="secondary" isDisabled={!!busy} onClick={() => run('msgon', async () => { const s = await get<Schemas['Settings']>('/api/settings'); await send('PUT', '/api/settings', { ...s, messaging_enabled: true }); setRec(await get<Action>(`/api/actions/${rec.id}`)) })}>
                  Switch messaging on
                </Button>
              </Box>
            )}
            {rec.status === 'failed' && <Alert isFullWidth color="negative" isDismissible={false} title="Stopped" description="A message was refused, so nothing more went out. Check the audit trail for the reason." />}
            {rec.next_stage && (
              <Box>
                <Button isLoading={busy === `${rec.id}:${rec.next_stage}`} isDisabled={!!rec.blocked_reason || !!busy} onClick={() => approve(rec, rec.next_stage!)}>
                  {rec.next_stage === 'rest' ? `${BUTTON.rest} (${planned - (c.verified ?? 0)})` : rec.status === 'failed' ? 'Retry' : BUTTON[rec.next_stage]}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Turn>

      {!!sent && (
        <Turn n={3} you={'Show me who paid'} title="Who paid after the link" badge={sent ? ['Simulated customers', 'neutral'] : undefined}>
        {!sent ? (
          <Text size="small" color="surface.text.gray.muted">Opens once links are out. Links stay valid for 48 hours, so give it time: move the demo clock forward.</Text>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Text weight="semibold">{c.sent_paid ?? 0} of {sent} customers with a link have paid, {rupees(c.recovered_paise ?? 0)} recovered.</Text>
            <Text size="small">Held back on purpose: {c.held_back_paid ?? 0} of {c.held_back ?? 0} paid on their own. {(c.held_back ?? 0) < 20 ? 'Too few customers to say what the link adds.' : ''}</Text>
            <Text size="small" color="surface.text.gray.muted">The customers here are simulated, with behaviour set in the synthetic world. This is not a result.</Text>
          </Box>
        )}
      </Turn>
      )}

      <Turn n={sent ? 4 : 3} analyzing={busy === 'verify'} you={result ? 'Check it held and close' : undefined} title="Check it held and close" badge={inc.status === 'closed' ? ['Closed', 'positive'] : undefined}>
        <Text size="small">{kind === 'probe' ? `Checks that your pay page has answered normally for ${NEED_HOURS} hours.` : 'Checks that orders are getting payment attempts again.'} A recovery that is half sent keeps the payment issue open.</Text>
        <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
          <Button variant="secondary" isLoading={busy === 'verify'} isDisabled={!!busy} onClick={() => run('verify', async () => { setResult(await send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`)); await refreshHealth(); onChanged() })}>
            Check it held and close
          </Button>
          {result && <Text weight="semibold" color={result.closeable ? 'feedback.text.positive.intense' : 'feedback.text.notice.intense'}>{result.line}</Text>}
        </Box>
        {result?.closeable && inc.status === 'closed' && (
          <SuccessMoment heading={result.total ? `${result.verified} of ${result.total} customers paid` : 'Your pay page works again'} detail={result.total ? `${rupees(result.restored_paise)} came back. This payment issue is closed.` : 'This payment issue is closed.'} />
        )}
      </Turn>

      {result?.closeable && inc.status === 'closed' && <NextSteps next={[{ label: 'Open the audit trail', onClick: () => nav('/audit') }, { label: 'See all payment issues', onClick: () => nav('/incidents') }, { label: 'See the first check', onClick: () => nav('/scan') }]} />}

      <Card>
        <CardBody>
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Box display="flex" gap="spacing.3" alignItems="center">
              <Heading as="h3" size="small">Demo controls</Heading>
              <Badge color="neutral">Simulated merchant</Badge>
            </Box>
            <Text size="small" color="surface.text.gray.muted">Your developer and the clock are simulated here.{health ? ` Pay page: ${health.page_mode === 'ok' ? `answering normally for ${health.healthy_hours} h` : `answering ${health.page_status}`}.` : ''}</Text>
            <Box display="flex" gap="spacing.4" flexWrap="wrap">
              {kind === 'probe' && (
                <Button variant="secondary" size="small" isDisabled={!!busy || health?.page_mode === 'ok'} onClick={() => run('fix', async () => { setHealth(await send<Health>('POST', '/merchant-mock/page-mode', { mode: 'ok' })); onChanged() })}>
                  Your developer fixes the pay page
                </Button>
              )}
              {[2, 24].map((h) => (
                <Button key={h} variant="secondary" size="small" isDisabled={!!busy} onClick={() => run('clock', async () => { await send('POST', '/api/clock/advance', { hours: h, incident: inc.id }); await refreshHealth(); onChanged() })}>
                  Move the clock forward {h} hours
                </Button>
              ))}
            </Box>
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}
