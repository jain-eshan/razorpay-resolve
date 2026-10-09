import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Badge, Box, Button, Heading, ProgressBar, SegmentedControl, SegmentedControlItem, Text } from '@razorpay/blade/components'
import { NextSteps, Turn } from './AgentAnswer'
import { SuccessMoment } from './SuccessMoment'
import { demoNote } from '../lib/demo'
import { get, isLive, rupees, send, type Schemas } from '../lib/api'

type Action = Schemas['Action']
type Escalation = Schemas['Escalation']
type Pack = { ref: string; what_happened: string; payment_ids: string[]; error_buckets: { code: string; count: number }[]; card_networks: string[]; ruled_out: string[]; already_tried: string[]; ask: string }

const ACCESS: Record<string, string> = { dry_run: 'Looks right, continue', first_5: 'Keep access on for the first 5', rest: 'Keep access on for the rest' }
const SEND: Record<string, string> = { dry_run: 'Looks right, continue', first_5: 'Send the first 5', rest: 'Send the rest' }

// INC-3. The cause is Razorpay's, so what the merchant can do is two things: keep these customers' access on while it is open, and hand Razorpay the evidence.
// Both wait for the founder. Nothing here moves money. Telling customers is a third step, and a message cannot be unsent. Once cards work again, each customer
// who was told a link was coming gets one, with a few held back to measure what the link adds.
export function RenewalFix({ inc, members, onChanged }: { inc: Schemas['IncidentDetail']; members: Schemas['Member'][]; onChanged: () => void }) {
  const nav = useNavigate()
  const [grant, setGrant] = useState<Action>()
  const [msg, setMsg] = useState<Action>()
  const [rec, setRec] = useState<Action>()
  const [previews, setPreviews] = useState<Schemas['MessagePreview'][]>([])
  const [linkPreviews, setLinkPreviews] = useState<Schemas['MessagePreview'][]>([])
  const [esc, setEsc] = useState<Escalation>()
  const [result, setResult] = useState<Schemas['VerifyResult']>()
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

  const loadPreview = useCallback((a: Action) => get<Schemas['MessagePreview'][]>(`/api/messages/preview?action_id=${a.id}`).then(a.action_type === 'recovery_link' ? setLinkPreviews : setPreviews), [])

  useEffect(() => {
    for (const a of inc.actions) {
      get<Action>(`/api/actions/${a.id}`).then((full) => {
        if (full.action_type === 'grant') setGrant(full)
        if (full.action_type === 'message') {
          setMsg(full)
          loadPreview(full).catch(() => undefined)
        }
        if (full.action_type === 'recovery_link') {
          setRec(full)
          loadPreview(full).catch(() => undefined)
        }
      })
    }
    get<Escalation[]>(`/api/escalations?incident_id=${inc.id}`).then((l) => setEsc(l[0])).catch(() => undefined)
    if (inc.status === 'closed') send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`).then(setResult).catch(() => undefined)
  }, [inc.id, inc.actions, inc.status, loadPreview])

  const done = grant?.item_counts.verified ?? 0
  const total = grant?.items.length ?? 0
  const rows = (grant?.items ?? []).map((i) => byPayment.get(i.payment_id)).filter((m): m is Schemas['Member'] => !!m)
  const messagesSent = (msg?.item_counts.verified ?? 0) > 0
  const canUndo = !!grant && ['approved', 'done', 'failed'].includes(grant.status) && !messagesSent
  const pack = esc?.pack as unknown as Pack | undefined
  const language = (msg?.params as { language?: string } | undefined)?.language ?? 'auto'
  const lc = rec?.item_counts ?? {}
  const linkHeld = ((rec?.params as { holdout?: string[] } | undefined)?.holdout ?? []).length
  const linkPlanned = rec?.items.length ?? 0
  const linkSent = lc.sent ?? 0
  const nLinks = 4
  const nVerify = messagesSent ? 5 : done > 0 ? 4 : 3

  const approve = (a: Action, set: (x: Action) => void, stage: Action['stage']) =>
    run(`${a.id}:${stage}`, async () => {
      const next = await send<Action>('POST', `/api/actions/${a.id}/approve`, { stage, approver: 'founder' })
      set(next)
      if (next.action_type === 'message' || next.action_type === 'recovery_link') await loadPreview(next)
      onChanged()
    })

  const stageButton = (a: Action | undefined, set: (x: Action) => void, BUTTON: Record<string, string>) =>
    a?.next_stage ? (
      <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
        {a.blocked_reason && <Text size="small" color="feedback.text.notice.intense">{a.blocked_reason}</Text>}
        <Button isLoading={busy === `${a.id}:${a.next_stage}`} isDisabled={!!a.blocked_reason || !!busy} onClick={() => approve(a, set, a.next_stage!)}>
          {a.next_stage === 'rest' ? `${BUTTON.rest} (${a.items.length - (a.item_counts.verified ?? 0)})` : a.status === 'failed' ? 'Retry' : BUTTON[a.next_stage]}
        </Button>
      </Box>
    ) : null

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="fix-panel">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="medium">What you can do</Heading>
        <Text size="small" color="surface.text.gray.muted">
          The cause is Razorpay's, so Blindspot cannot fix it. It can keep these customers' access on while Razorpay looks, give Razorpay the evidence, and send each customer a renewal link once cards work again. Every step waits for your approval, at every autonomy level. <Link to="/settings">Settings</Link>
        </Text>
      </Box>

      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Click through the steps. Each one is the engine's real answer.`} />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="That did not go through" description={error} />}

      <Turn n={1} analyzing={busy === 'plan' || busy === 'undo' || busy === `${grant?.id}:${grant?.next_stage}`} you={grant && grant.status !== 'drafted' ? (grant.status === 'reverted' ? 'Undo the extension' : 'Looks right, continue') : undefined}
        title="Keep access on for 3 days" badge={grant && grant.status !== 'reverted' ? [grant.status === 'done' ? 'Done' : grant.status === 'failed' ? 'Stopped' : grant.status === 'drafted' ? 'Waiting for you' : `${done} of ${total}`, grant.status === 'done' ? 'positive' : grant.status === 'failed' ? 'negative' : 'notice'] : undefined}>
        {!grant || grant.status === 'reverted' ? (
          <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
            <Text size="small">{grant?.status === 'reverted' ? 'Undone. Every record is back to how it was. Plan again whenever you are ready.' : 'Lists whose access would be kept on for 3 days from today. It never takes access away, and customers who already paid again are left alone. Changes nothing yet.'}</Text>
            <Button isLoading={busy === 'plan'} isDisabled={!!busy} onClick={() => run('plan', async () => { setGrant(await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'grant', params: {} })); setResult(undefined); onChanged() })}>
              Plan the extension
            </Button>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Text weight="semibold">{total} customers, {rupees(rows.reduce((a, m) => a + m.amount_paise, 0))} of renewals.</Text>
            {grant.status === 'drafted' && rows.slice(0, 5).map((m) => <Text key={m.payment_id} size="small">{m.customer_masked} · {m.plan} · {rupees(m.amount_paise)} · your records: {m.merchant_state}{m.complained ? ' · wrote in' : ''}</Text>)}
            {grant.status === 'drafted' && total > 5 && <Text size="small" color="surface.text.gray.muted">and {total - 5} more</Text>}
            {grant.status !== 'drafted' && (
              <>
                <ProgressBar label="Confirmed by your records" value={total ? Math.round((done / total) * 100) : 0} />
                <Text size="small">{done} of {total} confirmed active by your records after each change.</Text>
              </>
            )}
            {stageButton(grant, setGrant, ACCESS)}
            {canUndo && (
              <Box>
                <Button variant="tertiary" size="small" isDisabled={!!busy} onClick={() => run('undo', async () => { setGrant(await send<Action>('POST', `/api/actions/${grant.id}/revert`)); setMsg(undefined); setResult(undefined); onChanged() })}>
                  Undo these changes
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Turn>

      {done > 0 && (
        <Turn n={2} analyzing={busy === 'msgplan'} you="Tell the customers" title="Tell the customers" badge={msg ? [msg.status === 'done' ? 'Sent' : msg.status === 'drafted' ? 'Draft' : 'In progress', msg.status === 'done' ? 'positive' : 'neutral'] : undefined}>
          {!msg ? (
            <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
              <Text size="small">One message to each customer whose access is now confirmed, saying the renewal failed because of a payment network issue and not their card.</Text>
              <Button variant="secondary" isLoading={busy === 'msgplan'} isDisabled={!!busy} onClick={() => run('msgplan', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'message', params: { language: 'auto' } }); setMsg(a); await loadPreview(a) })}>
                Preview the message
              </Button>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap="spacing.4">
              {msg.status === 'drafted' && (
                <SegmentedControl label="Language" name="lang" value={language} onChange={({ value }) => run('lang', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'message', params: { language: value } }); setMsg(a); await loadPreview(a) })}>
                  <SegmentedControlItem value="auto">Auto</SegmentedControlItem>
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
              <Text size="small" color="surface.text.gray.muted">Written from a template. Auto uses each customer's own language, and the date comes from their own record. No link and no promise about money. Messages cannot be unsent, and once they go out the extension can no longer be undone.</Text>
              {msg.blocked_reason?.startsWith('Messaging') && (
                <Button variant="secondary" isDisabled={!!busy} onClick={() => run('msgon', async () => { const s = await get<Schemas['Settings']>('/api/settings'); await send('PUT', '/api/settings', { ...s, messaging_enabled: true }); setMsg(await get<Action>(`/api/actions/${msg.id}`)) })}>
                  Switch messaging on
                </Button>
              )}
              {stageButton(msg, setMsg, SEND)}
            </Box>
          )}
        </Turn>
      )}

      <Turn n={done > 0 ? 3 : 2} analyzing={busy === 'draft' || busy === 'sendesc'} you={esc ? (esc.status === 'sent' ? 'Send it to Razorpay' : 'Draft the evidence pack') : undefined}
        title="Send the evidence to Razorpay" badge={esc ? [esc.status === 'sent' ? 'Sent (simulated)' : 'Draft', esc.status === 'sent' ? 'positive' : 'notice'] : undefined}>
        {!esc || !pack ? (
          <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
            <Text size="small">One page for Razorpay's support desk: the payment ids, the error code, the hours, and what was ruled out. It holds no customer names, emails or phone numbers. Nothing is sent until you approve it.</Text>
            <Button variant="secondary" isLoading={busy === 'draft'} isDisabled={!!busy} onClick={() => run('draft', async () => { setEsc(await send<Escalation>('POST', '/api/escalations', { incident_id: inc.id, target: 'razorpay' })) })}>
              Draft the evidence pack
            </Button>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap="spacing.4">
            <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap"><Badge color="neutral" size="medium">{`Reference ${pack.ref}`}</Badge><Text size="small" color="surface.text.gray.muted">{pack.payment_ids.length} payments · {pack.card_networks.join(', ')}</Text></Box>
            <Text>{pack.what_happened}</Text>
            {pack.error_buckets.map((b) => <Text key={b.code} size="small">{b.count} payments failed with {b.code}</Text>)}
            {pack.ruled_out.map((r) => <Text key={r} size="small" color="surface.text.gray.muted">Ruled out: {r}</Text>)}
            {pack.already_tried.map((r) => <Text key={r} size="small" color="surface.text.gray.muted">Already tried: {r}</Text>)}
            <Box backgroundColor="surface.background.gray.subtle" borderRadius="medium" padding="spacing.5"><Text size="small">Ask: {pack.ask}</Text></Box>
            {esc.status === 'drafted' ? (
              <Box>
                <Button isLoading={busy === 'sendesc'} isDisabled={!!busy} onClick={() => run('sendesc', async () => { setEsc(await send<Escalation>('POST', `/api/escalations/${esc.id}/send`, { approver: 'founder' })); onChanged() })}>
                  Send to Razorpay
                </Button>
              </Box>
            ) : (
              <Text size="small" weight="semibold" color="feedback.text.positive.intense">Sent to Razorpay (simulated) as {pack.ref}. The prototype talks to no one, so no reply will come.</Text>
            )}
          </Box>
        )}
      </Turn>

      {messagesSent && (
        <Turn n={nLinks} analyzing={busy === 'linkplan'} you={rec && rec.status !== 'drafted' ? 'Send the renewal links' : undefined} title="Send the renewal links, in stages"
          badge={rec ? [rec.status === 'done' ? 'Sent' : rec.status === 'drafted' ? 'Draft' : rec.status === 'failed' ? 'Stopped' : `${linkSent} of ${linkPlanned - linkHeld}`, rec.status === 'done' ? 'positive' : rec.status === 'failed' ? 'negative' : 'neutral'] : undefined}>
          {!rec ? (
            <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
              <Text size="small">The message promised each customer one renewal link once this is fixed. This lists who gets it: customers who were told, and have not paid since. A few are held back on purpose. Changes nothing yet.</Text>
              <Button variant="secondary" isLoading={busy === 'linkplan'} isDisabled={!!busy} onClick={() => run('linkplan', async () => { const a = await send<Action>('POST', `/api/incidents/${inc.id}/actions`, { action_type: 'recovery_link', params: { language: 'auto' } }); setRec(a); await loadPreview(a); onChanged() })}>
                Plan the links
              </Button>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap="spacing.4">
              <Text weight="semibold">{linkPlanned} customers, {linkHeld} of them held back on purpose.</Text>
              <Text size="small" color="surface.text.gray.muted">The held-back customers get nothing. Comparing them with the rest is the only way to tell what the link adds. With so few customers the comparison is a rough guide at best.</Text>
              {linkPreviews.map((p) => (
                <Box key={p.template_id + p.language} backgroundColor="surface.background.gray.subtle" borderRadius="medium" padding="spacing.5" display="flex" flexDirection="column" gap="spacing.3">
                  <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                    <Badge color="neutral">{p.category.replace('_', ' ')}</Badge>
                    <Text size="small" color="surface.text.gray.muted">From {p.sender} · to {p.recipients} customers · {p.language === 'en' ? 'English' : 'Hinglish'}</Text>
                  </Box>
                  <Text>{p.body}</Text>
                </Box>
              ))}
              <Text size="small" color="surface.text.gray.muted">Written from a template. The link is made through Razorpay's payment link API (simulated here), valid for {String((rec.params as { valid_hours?: number }).valid_hours ?? 48)} hours, no discount, one per customer. Messages cannot be unsent.</Text>
              {rec.blocked_reason && <Alert isFullWidth color="notice" isDismissible={false} title="Not yet" description={rec.blocked_reason} />}
              {rec.status === 'failed' && <Alert isFullWidth color="negative" isDismissible={false} title="Stopped" description="A message was refused, so nothing more went out. Check the audit log for the reason." />}
              {stageButton(rec, setRec, SEND)}
            </Box>
          )}
        </Turn>
      )}

      {linkSent > 0 && (
        <Turn n={nLinks + 1} you="Show me what the customers did" title="What the customers did" badge={['Simulated customers', 'neutral']}>
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Text weight="semibold">{lc.sent_paid ?? 0} of {linkSent} customers with a link have renewed, {rupees(lc.recovered_paise ?? 0)} collected.</Text>
            <Text size="small">Held back on purpose: {lc.held_back_paid ?? 0} of {lc.held_back ?? 0} renewed on their own. {(lc.held_back ?? 0) < 20 ? 'Too few customers to say what the link adds.' : ''}</Text>
            <Text size="small" color="surface.text.gray.muted">The customers here are simulated, with behaviour set in the synthetic world. This is not a result. Links stay valid for 48 hours, so give it time.</Text>
            <Box>
              <Button variant="secondary" size="small" isDisabled={!!busy} onClick={() => run('clock', async () => { await send('POST', '/api/clock/advance', { hours: 48, incident: inc.id }); setRec(await get<Action>(`/api/actions/${rec!.id}`)); onChanged() })}>
                Move the demo clock forward 48 hours
              </Button>
            </Box>
          </Box>
        </Turn>
      )}

      {(done > 0 || inc.status === 'closed') && (
        <Turn n={nVerify} analyzing={busy === 'verify'} you={result ? 'Verify and close' : undefined} title="Verify and close" badge={inc.status === 'closed' ? ['Closed', 'positive'] : undefined}>
          <Text size="small">Checks every customer against your records again, and that card renewals have gone through again since the last failure. If renewal links went out, it also counts who renewed, and a link send that is half done keeps the incident open. Collecting the renewals of customers without a link is not part of this step.</Text>
          <Box display="flex" gap="spacing.4" alignItems="center" flexWrap="wrap">
            <Button variant="secondary" isLoading={busy === 'verify'} isDisabled={!grant || !!busy} onClick={() => run('verify', async () => { setResult(await send<Schemas['VerifyResult']>('POST', `/api/incidents/${inc.id}/verify`)); onChanged() })}>
              Verify and close
            </Button>
            {result && <Text weight="semibold" color={result.closeable ? 'feedback.text.positive.intense' : 'feedback.text.notice.intense'}>{result.line}</Text>}
          </Box>
          {result?.closeable && inc.status === 'closed' && <SuccessMoment heading={`${result.verified} customers kept their access`} detail="Cards work again. This incident is closed." />}
        </Turn>
      )}

      {result?.closeable && inc.status === 'closed' && <NextSteps next={[{ label: 'Open the audit log', onClick: () => nav('/audit') }, { label: 'See all incidents', onClick: () => nav('/incidents') }, { label: 'Run the Day-0 scan', onClick: () => nav('/scan') }]} />}
    </Box>
  )
}
