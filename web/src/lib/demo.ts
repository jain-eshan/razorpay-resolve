// The guided demo. The hosted site has no server, so every call the screens make is answered here from frames recorded from the real
// engine (scripts/demo_script.py -> /snapshot/demo.json). This file only decides which recorded frame comes next; it writes no
// text of its own except error messages that mirror the server's.
import type { Schemas } from './api'

type Audit = Schemas['AuditEntry']
type Frame<T = unknown> = { data: T; audit: Audit[] }
type Action = Schemas['Action']
type Detail = Schemas['ThreadDetail']
type Scenario = { id: string; channel: string; steps: { customer: string; step: Schemas['ThreadStep'] }[]; approve?: Detail; payment_id?: string
  follow_up?: { channel: string; customer: string; step: Schemas['ThreadStep']; public_after: Detail } }
type Demo = {
  fix: {
    grant: Record<'drafted' | 'dry_run' | 'first_5' | 'rest', Frame<Action>>
    messages: { blocked: Record<string, Frame<Action>>; ready: Record<string, Frame<Action>>; previews: Record<string, unknown>; stages: Record<string, Frame<Action>> }
    verify_none: Frame; verify_dry_run: Frame; verify_first_5: Frame; verify_401: Frame; verify_notyet: Frame; verify_closed: Frame
    hook_broken: Frame; hook_ok: Frame; hook_ok24: Frame; revert_first_5: Frame<Action>; revert_rest: Frame<Action>; settings: Schemas['Settings']
  }
  chat: Record<string, Scenario>
  learning: Record<string, { weekly: Record<'none' | 'told' | 'reviewed', Frame<Schemas['LearningWeekly']>>; params: Record<'none' | 'reviewed', Frame<Schemas['LearningParam'][]>>; ack: Frame; review: Frame<Schemas['LearningWeekly']> }>
  renewal: {
    grant: Record<'drafted' | 'dry_run' | 'first_5' | 'rest', Frame<Action>>
    detail: Record<'base' | 'first5' | 'rest' | 'closed', Frame<Schemas['IncidentDetail']>>
    members: Record<'base' | 'first5' | 'rest' | 'closed', Frame<Schemas['Member'][]>>
    verify: Record<'none' | 'dry_run' | 'first5' | 'rest' | 'closed', Frame<Schemas['VerifyResult']>>
    escalation: Record<'drafted' | 'sent_plain' | 'sent_graced', Frame<Schemas['Escalation']>>
    messages: { blocked: Record<string, Frame<Action>>; ready: Record<string, Frame<Action>>; previews: Record<string, unknown>; stages: Record<string, Frame<Action>> }
    revert: Record<'first_5' | 'rest', Frame<Action>>
    links: { plan: Frame<Action>; previews: unknown; stages: Record<'dry_run' | 'first_5' | 'rest' | 'rest_48', Frame<Action>>; verify: Record<'running' | 'sent' | 'paid', Frame<Schemas['VerifyResult']>> }
  }
  duplicate: {
    none: Frame; plan: Frame<Action>; dry: Frame<Action>
    k: (DupView & { action: Frame<Action>; verify: Frame })[]
    t: Record<'3' | '24' | '72', DupView>
    closed: DupView
    sent: { board: Schemas['RefundBoard'] }
    messages: { blocked: Record<string, Frame<Action>>; ready: Record<string, Frame<Action>>; previews: Record<string, unknown>; stages: Record<string, Frame<Action>> }
    verify: Record<'soon' | 'closed', Frame>
  }
  guard: Record<'w0_p0' | 'w0_p1' | 'w1_p0' | 'w1_p1', Schemas['ReleaseCheck']>
  zone1: {
    probe: Record<'broken' | 'ok', Frame>
    health: Record<'broken' | 'ok0' | 'ok1' | 'ok2', Frame>
    plan: Record<'on' | 'off', Record<'broken' | 'ok0' | 'ok1' | 'ok2', Frame<Action>>>
    previews: unknown
    stages: Record<'dry_run' | 'first_5' | 'rest' | 'rest0' | 'rest24' | 'rest48', Frame<Action>>
    members: Record<Phase, Frame<Schemas['Member'][]>>
    detail: Record<Phase, Frame<Schemas['IncidentDetail']>>
    verify: Record<'broken' | 'wait0' | 'wait1' | 'closed_none' | 'running' | 'closed_rest0' | 'closed_rest24' | 'closed_rest48', Frame>
  }
}
type Phase = 'base' | 'first5' | 'rest0' | 'rest24' | 'rest48'
type DupView = { board: Schemas['RefundBoard']; members: Schemas['Member'][]; overlay: { status: Schemas['IncidentDetail']['status']; fixed: number; at_risk_paise: number } }

const STAGES = ['dry_run', 'first_5', 'rest'] as const
const NEXT: Record<string, string | undefined> = { drafted: 'dry_run', dry_run: 'first_5', first_5: 'rest' }
export const NOW = new Date('2026-10-02T10:40:00+05:30')
const label = (s: string) => s.replace('_', ' ')

const st = {
  g: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest' | 'reverted',
  m: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest',
  lang: 'auto', messagingOn: false, mode: '401', hours: 0, closed: false,
  revert: undefined as Frame<Action> | undefined,
  audit: [] as Audit[], nextId: 1,
  threads: {} as Record<string, Detail>, order: [] as string[], byThread: {} as Record<string, string>,
}

// The learning screen. One piece of feedback is recorded per visit, because what the review changes depends on which monitors raised that incident.
const learn = { stage: 'none' as 'none' | 'told' | 'reviewed', incident: '' }

// Hero B (INC-4) has its own clock, because the demo user moves it from that page. mode: the pay page. r: how far the recovery links got.
const z = {
  mode: '404' as '404' | 'ok', fixAt: 0, hours: 0, r: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest', sentAt: 0, status: 'open' as 'open' | 'verifying' | 'closed',
}
const ZID = 'act_4_recovery_link'
const pageKey = () => (z.mode === '404' ? 'broken' : z.hours - z.fixAt < 1 ? 'ok0' : z.hours - z.fixAt < 2 ? 'ok1' : 'ok2') as 'broken' | 'ok0' | 'ok1' | 'ok2'
const since = () => z.hours - z.sentAt
const phase = (): Phase => (z.r === 'rest' ? (since() < 24 ? 'rest0' : since() < 48 ? 'rest24' : 'rest48') : z.r === 'first_5' ? 'first5' : 'base')
const zAction = (d: Demo): Frame<Action> | undefined => {
  const f = d.zone1
  if (z.r === 'none') return undefined
  if (z.r === 'drafted') return f.plan[st.messagingOn ? 'on' : 'off'][pageKey()]
  if (z.r === 'rest') return f.stages[phase() as 'rest0' | 'rest24' | 'rest48']
  return f.stages[z.r]
}

// INC-3 (Razorpay's side) has its own small state, because the demo user works through it from its own page: grace in stages, the customers told, the pack sent.
const c3 = {
  g: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest' | 'reverted', m: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest', lang: 'auto',
  esc: 'none' as 'none' | 'drafted' | 'sent', graced: false, closed: false, revert: undefined as Frame<Action> | undefined,
  l: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest', lh: 0, // the renewal links, and the hours the clock has moved since they went out
}
const c3Seen = new Set<unknown>() // closing verify frames already shown, so each adds its audit lines once
const c3Grant = (d: Demo) => (c3.g === 'none' ? undefined : c3.g === 'reverted' ? c3.revert : d.renewal.grant[c3.g])
const c3Msg = (d: Demo): Frame<Action> | undefined => {
  if (c3.m === 'none') return undefined
  const f = c3.m === 'drafted' ? (st.messagingOn ? d.renewal.messages.ready : d.renewal.messages.blocked)[c3.lang] : d.renewal.messages.stages[c3.m]
  return { ...f, data: { ...f.data, params: { ...f.data.params, language: c3.lang } } }
}
const c3Link = (d: Demo): Frame<Action> | undefined => (c3.l === 'none' ? undefined : c3.l === 'drafted' ? d.renewal.links.plan : c3.l === 'rest' && c3.lh >= 48 ? d.renewal.links.stages.rest_48 : d.renewal.links.stages[c3.l])
const c3Phase = () => (c3.closed ? 'closed' : c3.g === 'first_5' ? 'first5' : c3.g === 'rest' ? 'rest' : 'base') as 'base' | 'first5' | 'rest' | 'closed'
const c3Esc = (d: Demo) => (c3.esc === 'none' ? undefined : c3.esc === 'drafted' ? d.renewal.escalation.drafted : c3.graced ? d.renewal.escalation.sent_graced : d.renewal.escalation.sent_plain)

// INC-2 (charged twice). k: how many customers have been refunded, in the order of the plan. h: hours the demo user has moved the clock since all were refunded
// (the bank processes UPI refunds after 2 hours, netbanking after 24, cards after 72; frames were recorded at 3, 24 and 72). fixAt: the hour the developer shipped the fix.
const dp = { plan: 'none' as 'none' | 'drafted' | 'approved', k: 0, h: 0, fixAt: -1, m: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest', lang: 'auto', closed: false }
const DID = 'act_2_refund'
const DMID = 'act_2_message'
const dpTime = () => (dp.h >= 72 ? '72' : dp.h >= 24 ? '24' : dp.h >= 3 ? '3' : null) as '3' | '24' | '72' | null
const dpView = (d: Demo): DupView => {
  const dd = d.duplicate
  const v = dp.k === 15 && dpTime() ? dd.t[dpTime()!] : dd.k[dp.k]
  return { board: dp.m === 'rest' ? dd.sent.board : v.board, members: v.members, overlay: dp.closed ? dd.closed.overlay : v.overlay }
}
const dpRefund = (d: Demo) => (dp.plan === 'none' ? undefined : dp.plan === 'drafted' ? d.duplicate.plan : d.duplicate.k[dp.k].action)
const dpMsg = (d: Demo): Frame<Action> | undefined => {
  if (dp.m === 'none') return undefined
  const f = dp.m === 'drafted' ? (st.messagingOn ? d.duplicate.messages.ready : d.duplicate.messages.blocked)[dp.lang] : d.duplicate.messages.stages[dp.m]
  return { ...f, data: { ...f.data, params: { ...f.data.params, language: dp.lang } } }
}

let loaded: Promise<Demo> | undefined
const demo = () => (loaded ??= fetch('/snapshot/demo.json').then((r) => r.json() as Promise<Demo>))
const cache: Record<string, Promise<unknown>> = {}
const stat = <T>(p: string) => (cache[p] ??= fetch(`/snapshot/${p}.json`).then((r) => r.json())) as Promise<T>

const add = (rows: Audit[]) => rows.forEach((r) => st.audit.push({ ...r, id: st.nextId++ }))
const clockNow = () => new Date(NOW.getTime() + st.hours * 3600_000).toISOString()

function grantFrame(d: Demo): Frame<Action> | undefined {
  if (st.g === 'none') return undefined
  return st.g === 'reverted' ? st.revert : d.fix.grant[st.g]
}

function msgFrame(d: Demo): Frame<Action> | undefined {
  if (st.m === 'none') return undefined
  const f = st.m === 'drafted' ? (st.messagingOn ? d.fix.messages.ready : d.fix.messages.blocked)[st.lang] : d.fix.messages.stages[st.m]
  return { ...f, data: { ...f.data, params: { ...f.data.params, language: st.lang } } }
}

const restored = (d: Demo) => new Set((st.g === 'first_5' || st.g === 'rest' ? d.fix.grant[st.g].data.items : []).filter((i) => i.status === 'verified').map((i) => i.payment_id))

async function members(d: Demo) {
  const base = await stat<Schemas['Member'][]>('incidents/INC-1/members')
  const r = restored(d)
  return base.map((m) => (r.has(m.payment_id) ? { ...m, tier: 'excluded' as const, exclusion_reason: 'restored by Blindspot', merchant_state: 'active' } : m))
}

async function incident(d: Demo) {
  const base = await stat<Schemas['IncidentDetail']>('incidents/INC-1')
  const r = restored(d)
  const ms = (await stat<Schemas['Member'][]>('incidents/INC-1/members')).filter((m) => r.has(m.payment_id))
  const status = st.g === 'first_5' ? 'fixing' : st.g === 'rest' ? (st.closed ? 'closed' : 'verifying') : 'open'
  const acts = [grantFrame(d), msgFrame(d)].filter((f): f is Frame<Action> => !!f).map((f) => f.data)
  return { ...base, status, actions: acts, tier_counts: { ...base.tier_counts, exact: base.tier_counts.exact - ms.length, excluded: base.tier_counts.excluded + ms.length },
    at_risk_paise: base.at_risk_paise - ms.reduce((a, m) => a + m.amount_paise, 0) }
}

const settings = (d: Demo) => ({ ...d.fix.settings, messaging_enabled: st.messagingOn, autonomy: 'suggest' as const })

export async function demoGet(path: string): Promise<unknown | undefined> {
  const d = await demo()
  const [p, q = ''] = path.split('?')
  if (p === '/merchant-mock/health') {
    if (st.mode !== 'ok') return d.fix.hook_broken.data
    return st.hours >= 24 ? d.fix.hook_ok24.data : { ...(d.fix.hook_ok.data as object), healthy_hours: st.hours }
  }
  if (p === '/merchant-mock/page-health') return d.zone1.health[pageKey()].data
  if (p === '/api/guard/release-check') return d.guard[`${st.mode === 'ok' ? 'w1' : 'w0'}_${z.mode === 'ok' ? 'p1' : 'p0'}`]  // what the user has fixed so far decides which recorded answer
  if (p === '/merchant-mock/app-health') {
    const fixed = dp.fixAt >= 0
    return { app_mode: fixed ? 'fixed' : 'broken', app_fixed_since: null, healthy_hours: fixed ? dp.h - dp.fixAt : 0, signal_healthy: fixed && dp.h - dp.fixAt >= 24 }
  }
  if (p === '/api/incidents/INC-2') {
    const base = await stat<Schemas['IncidentDetail']>('incidents/INC-2')
    return { ...base, ...dpView(d).overlay, actions: [dpRefund(d), dpMsg(d)].filter((f): f is Frame<Action> => !!f).map((f) => f.data) }
  }
  if (p === '/api/incidents/INC-2/members') {
    const tier = new URLSearchParams(q).get('tier')
    return dpView(d).members.filter((m) => !tier || m.tier === tier)
  }
  if (p === '/api/incidents/INC-2/refunds') return dpView(d).board
  if (p === `/api/actions/${DID}` || p === `/api/actions/${DMID}`) {
    const f = p === `/api/actions/${DMID}` ? dpMsg(d) : dpRefund(d)
    if (!f) throw new Error('404 action')
    return f.data
  }
  if (p === '/api/messages/preview' && q.includes(DMID)) return d.duplicate.messages.previews[dp.lang]
  if (p === '/api/settings') return settings(d)
  if (p === '/api/incidents/INC-3') return { ...d.renewal.detail[c3Phase()].data, actions: [c3Grant(d), c3Msg(d), c3Link(d)].filter((f): f is Frame<Action> => !!f).map((f) => f.data) }
  if (p === '/api/incidents/INC-3/members') {
    const tier = new URLSearchParams(q).get('tier')
    return d.renewal.members[c3Phase()].data.filter((m) => !tier || m.tier === tier)
  }
  if (p === '/api/actions/act_3_grant' || p === '/api/actions/act_3_message') {
    const f = p.endsWith('_message') ? c3Msg(d) : c3Grant(d)
    if (!f) throw new Error('404 action')
    return f.data
  }
  if (p === '/api/messages/preview' && q.includes('act_3_message')) return d.renewal.messages.previews[c3.lang]
  if (p === '/api/messages/preview' && q.includes('act_3_recovery_link')) return d.renewal.links.previews
  if (p === '/api/actions/act_3_recovery_link') {
    if (!c3Link(d)) throw new Error('404 action')
    return c3Link(d)!.data
  }
  if (p === '/api/escalations') return c3Esc(d) ? [c3Esc(d)!.data] : []
  if (p === '/api/escalations/esc_3_razorpay') {
    if (!c3Esc(d)) throw new Error('404 escalation')
    return c3Esc(d)!.data
  }
  if (p === `/api/actions/${ZID}`) {
    const f = zAction(d)
    if (!f) throw new Error('404 action')
    return f.data
  }
  if (p === '/api/incidents/INC-4') {
    const f = d.zone1.detail[phase()].data
    return { ...f, status: z.status, actions: [zAction(d)?.data].filter(Boolean) }
  }
  if (p === '/api/incidents/INC-4/members') {
    const tier = new URLSearchParams(q).get('tier')
    return d.zone1.members[phase()].data.filter((m) => !tier || m.tier === tier)
  }
  if (p.startsWith('/api/actions/')) {
    const f = p.endsWith('_message') ? msgFrame(d) : grantFrame(d)
    if (!f) throw new Error('404 action')
    return f.data
  }
  if (p === '/api/messages/preview') return q.includes(ZID) ? d.zone1.previews : d.fix.messages.previews[st.lang]
  if (p === '/api/incidents/INC-1') return incident(d)
  if (p === '/api/incidents/INC-1/members') {
    const tier = new URLSearchParams(q).get('tier')
    return (await members(d)).filter((m) => !tier || m.tier === tier)
  }
  if (p === '/api/audit') return [...st.audit].reverse()
  if (p === '/api/learning/weekly') return d.learning[learn.incident || 'INC-1'].weekly[learn.stage].data
  if (p === '/api/learning/params') return d.learning[learn.incident || 'INC-1'].params[learn.stage === 'reviewed' ? 'reviewed' : 'none'].data
  if (p === '/api/threads') return st.order.map((id) => st.threads[id])
  if (p.startsWith('/api/threads/')) return st.threads[p.split('/')[3]]
  return undefined
}

export async function demoSend(method: string, path: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const d = await demo()
  const f = d.fix
  const zt = d.zone1
  if (path === '/api/feedback') {
    const id = String(body.subject_id)
    if (body.kind !== 'false_alarm' || !d.learning[id]) throw new Error('Reporting a missed alert works in the live version, not in this demo.')
    if (learn.stage !== 'none' && learn.incident !== id) throw new Error('The hosted demo takes one piece of feedback. Run it live to give more.')
    if (learn.stage === 'none') {
      learn.stage = 'told'
      learn.incident = id
      add(d.learning[id].ack.audit)
    }
    return d.learning[id].ack.data
  }
  if (path === '/api/learning/run') {
    const l = d.learning[learn.incident || 'INC-1']
    if (learn.stage === 'told') {
      learn.stage = 'reviewed'
      add(l.review.audit)
    }
    return l.weekly[learn.stage].data
  }
  if (path === '/api/probes/run') return (z.mode === '404' ? zt.probe.broken : zt.probe.ok).data
  if (path === '/merchant-mock/page-mode') {
    z.mode = 'ok'
    z.fixAt = z.hours
    return zt.health.ok0.data
  }
  if (path === '/api/incidents/INC-4/actions') {
    if (z.r === 'none') {
      z.r = 'drafted'
      add(zt.plan.off.broken.audit)
    }
    return zAction(d)!.data
  }
  if (path === `/api/actions/${ZID}/approve`) {
    const stage = body.stage as string
    if (!st.messagingOn) throw new Error('Messaging is switched off. Turn it on in settings, then approve.')
    const gate = zt.plan.on[pageKey()].data.blocked_reason
    if (gate) throw new Error(gate)
    const next = NEXT[z.r === 'rest' ? 'rest' : z.r]
    if (!next || STAGES.indexOf(stage as (typeof STAGES)[number]) < STAGES.indexOf(next as (typeof STAGES)[number])) return zAction(d)!.data
    if (stage !== next) throw new Error(`Approve '${label(next)}' next, not '${label(stage)}'.`)
    z.r = stage as typeof z.r
    if (stage === 'rest') z.sentAt = z.hours
    add(zt.stages[stage as 'dry_run' | 'first_5' | 'rest'].audit)
    return zAction(d)!.data
  }
  if (path === '/api/incidents/INC-4/verify') {
    const k = z.mode === '404' ? 'broken' : pageKey() === 'ok0' ? 'wait0' : pageKey() === 'ok1' ? 'wait1'
      : z.r === 'first_5' ? 'running' : z.r === 'rest' ? (`closed_${phase()}` as 'closed_rest0') : 'closed_none'
    const fr = zt.verify[k]
    z.status = k.startsWith('closed') ? 'closed' : k === 'broken' ? 'open' : 'verifying'
    if (k.startsWith('closed')) add(fr.audit)
    return fr.data
  }
  if (path === '/merchant-mock/app-mode') {
    if (dp.fixAt < 0) dp.fixAt = dp.h
    return demoGet('/merchant-mock/app-health')
  }
  if (path === '/api/incidents/INC-2/actions') {
    const dd = d.duplicate
    if (body.action_type === 'refund') {
      if (dp.plan === 'none') {
        dp.plan = 'drafted'
        add(dd.plan.audit)
      }
      return dpRefund(d)!.data
    }
    if (dp.k < 15 || dpTime() !== '72') throw new Error('In the hosted demo, tell the customers once every refund has its bank reference: refund all of them, then move the clock forward 72 hours. The live version can do it in steps.')
    dp.lang = (body.params as { language?: string } | undefined)?.language ?? 'auto'
    if (dp.m === 'none') {
      dp.m = 'drafted'
      add(dd.messages.blocked.auto.audit)
    }
    return dpMsg(d)!.data
  }
  if (path === `/api/actions/${DID}/approve`) {
    if (body.stage !== 'dry_run') throw new Error("Refunds are approved one customer at a time. Use the Refund button on a customer's row.")
    if (dp.plan === 'drafted') {
      dp.plan = 'approved'
      add(d.duplicate.dry.audit)
    }
    return dpRefund(d)!.data
  }
  const one = path.match(/^\/api\/actions\/act_2_refund\/items\/([^/]+)\/approve$/)
  if (one) {
    const dd = d.duplicate
    if (dp.plan !== 'approved') throw new Error('Review the list first: approve the test run, then refund customers one by one.')
    const i = dd.k[0].board.rows.findIndex((r) => r.payment_id === one[1])
    if (i < 0) throw new Error(`${one[1]} is not in this plan.`)
    if (i < dp.k) return dpRefund(d)!.data   // a repeat click: already refunded, nothing changes
    if (i > dp.k) throw new Error('In the hosted demo, refund the customers in the order shown. The live version lets you pick anyone.')
    dp.k += 1
    add(dd.k[dp.k].action.audit)
    return dpRefund(d)!.data
  }
  if (path === `/api/actions/${DID}/revert`) throw new Error("A refund cannot be undone. The money has gone back to the customer's original payment method.")
  if (path === `/api/actions/${DMID}/revert`) throw new Error('Messages cannot be unsent.')
  if (path === `/api/actions/${DMID}/approve`) {
    const stage = body.stage as string
    if (!st.messagingOn) throw new Error('Messaging is switched off. Turn it on in settings, then approve.')
    const next = NEXT[dp.m]
    if (!next || STAGES.indexOf(stage as (typeof STAGES)[number]) < STAGES.indexOf(next as (typeof STAGES)[number])) return dpMsg(d)!.data
    if (stage !== next) throw new Error(`Approve '${label(next)}' next, not '${label(stage)}'.`)
    dp.m = stage as typeof dp.m
    add(d.duplicate.messages.stages[stage].audit)
    return dpMsg(d)!.data
  }
  if (path === '/api/incidents/INC-2/verify') {
    const dd = d.duplicate
    if (dp.plan === 'none') return dd.none.data
    if (dp.k < 15 || dp.fixAt < 0) return dd.k[dp.k].verify.data
    if (dp.h - dp.fixAt < 24) return dd.verify.soon.data
    if (!dp.closed) {
      dp.closed = true
      add(dd.verify.closed.audit)
    }
    return dd.verify.closed.data
  }
  if (path === '/api/incidents/INC-3/actions') {
    const r3 = d.renewal
    if (body.action_type === 'grant') {
      if (c3.g === 'none' || c3.g === 'reverted') {
        c3.g = 'drafted'
        add(r3.grant.drafted.audit)
      }
      return c3Grant(d)!.data
    }
    if (body.action_type === 'recovery_link') {
      if (c3.m === 'none') throw new Error('Tell the customers first. The link follows the message that promised it, and goes only to customers who got that message.')
      if (c3.m !== 'rest') throw new Error('In the hosted demo, send the links once everyone has been told. The live version can do it in steps.')
      if (c3.l === 'none') {
        c3.l = 'drafted'
        add(r3.links.plan.audit)
      }
      return c3Link(d)!.data
    }
    if (c3.g === 'none' || c3.g === 'drafted' || c3.g === 'dry_run' || c3.g === 'reverted') throw new Error('Nothing to do yet. Restore access first: a message says access is on, so it only goes to customers whose access is confirmed.')
    if (c3.g !== 'rest') throw new Error('In the hosted demo, tell the customers once access is on for all of them. The live version can do it in steps.')
    c3.lang = (body.params as { language?: string } | undefined)?.language ?? 'auto'
    if (c3.m === 'none') {
      c3.m = 'drafted'
      add(r3.messages.blocked.auto.audit)
    }
    return c3Msg(d)!.data
  }
  if (path === '/api/actions/act_3_recovery_link/revert') throw new Error('Messages cannot be unsent.')
  if (path === '/api/actions/act_3_recovery_link/approve') {
    if (!st.messagingOn) throw new Error('Messaging is switched off. Turn it on in settings, then approve.')
    const stage = body.stage as string
    const next = NEXT[c3.l]
    if (!next || STAGES.indexOf(stage as (typeof STAGES)[number]) < STAGES.indexOf(next as (typeof STAGES)[number])) return c3Link(d)!.data
    if (stage !== next) throw new Error(`Approve '${label(next)}' next, not '${label(stage)}'.`)
    c3.l = stage as typeof c3.l
    add(d.renewal.links.stages[stage as (typeof STAGES)[number]].audit)
    return c3Link(d)!.data
  }
  const a3 = path.match(/^\/api\/actions\/act_3_(grant|message)\/(approve|revert)$/)
  if (a3) {
    const [, kind, verb] = a3
    const r3 = d.renewal
    if (verb === 'revert') {
      if (kind === 'message') throw new Error('Messages cannot be unsent.')
      if (c3.g === 'drafted' || c3.g === 'none') throw new Error('Nothing has run yet, so there is nothing to undo.')
      if (c3.m === 'first_5' || c3.m === 'rest') throw new Error('Customers were already told their access is on, so the grants can no longer be undone.')
      c3.revert = c3.g === 'rest' ? r3.revert.rest : r3.revert.first_5
      add(c3.revert.audit)
      c3.g = 'reverted'
      c3.m = 'none'
      c3.closed = false
      c3Seen.clear()
      return c3.revert.data
    }
    const stage = body.stage as string
    if (kind === 'grant') {
      const next = NEXT[c3.g]
      if (!next || STAGES.indexOf(stage as (typeof STAGES)[number]) < STAGES.indexOf(next as (typeof STAGES)[number])) return c3Grant(d)!.data
      if (stage !== next) throw new Error(`Approve '${label(next)}' next, not '${label(stage)}'.`)
      c3.g = stage as typeof c3.g
      add(r3.grant[stage as (typeof STAGES)[number]].audit)
      return c3Grant(d)!.data
    }
    if (!st.messagingOn) throw new Error('Messaging is switched off. Turn it on in settings, then approve.')
    const next = NEXT[c3.m]
    if (!next || STAGES.indexOf(stage as (typeof STAGES)[number]) < STAGES.indexOf(next as (typeof STAGES)[number])) return c3Msg(d)!.data
    if (stage !== next) throw new Error(`Approve '${label(next)}' next, not '${label(stage)}'.`)
    c3.m = stage as typeof c3.m
    add(r3.messages.stages[stage].audit)
    return c3Msg(d)!.data
  }
  if (path === '/api/incidents/INC-3/verify') {
    const r3 = d.renewal
    const fr = c3.l === 'first_5' ? r3.links.verify.running : c3.l === 'rest' ? (c3.lh >= 48 ? r3.links.verify.paid : r3.links.verify.sent)
      : c3.g === 'none' || c3.g === 'reverted' ? r3.verify.none : c3.g === 'drafted' || c3.g === 'dry_run' ? r3.verify.dry_run : c3.g === 'first_5' ? r3.verify.first5 : r3.verify.closed
    if (fr.data.closeable && !c3Seen.has(fr)) {
      c3Seen.add(fr)
      c3.closed = true
      add(fr.audit)
    }
    return fr.data
  }
  if (path === '/api/escalations') {
    if (body.incident_id !== 'INC-3') throw new Error("Blindspot has not put this on Razorpay's side, so there is nothing to send them. Send the evidence pack to your own developer.")
    if (c3.esc === 'none') {
      c3.esc = 'drafted'
      add(d.renewal.escalation.drafted.audit)
    }
    return c3Esc(d)!.data
  }
  if (path === '/api/escalations/esc_3_razorpay/send') {
    if (c3.esc === 'none') throw new Error('Escalation esc_3_razorpay not found.')
    if (c3.esc === 'drafted') {
      c3.esc = 'sent'
      c3.graced = c3.g === 'rest'
      add(c3Esc(d)!.audit)
    }
    return c3Esc(d)!.data
  }
  if (path === '/api/incidents/INC-1/actions') {
    if (body.action_type === 'grant') {
      if (st.g === 'none' || st.g === 'reverted') {
        st.g = 'drafted'
        add(f.grant.drafted.audit)
      }
      return grantFrame(d)!.data
    }
    if (st.g !== 'first_5' && st.g !== 'rest') throw new Error('Nothing to do yet. Restore access first: a message says access is on, so it only goes to customers whose access is confirmed.')
    st.lang = (body.params as { language?: string } | undefined)?.language ?? 'auto'
    if (st.m === 'none') {
      st.m = 'drafted'
      add(f.messages.blocked.auto.audit)
    }
    return msgFrame(d)!.data
  }
  const m = path.match(/^\/api\/actions\/(act_\d+_(grant|message))\/(approve|revert)$/)
  if (m) {
    const [, , kind, verb] = m
    if (verb === 'revert') {
      if (kind === 'message') throw new Error('Messages cannot be unsent.')
      if (st.g === 'drafted' || st.g === 'none') throw new Error('Nothing has run yet, so there is nothing to undo.')
      if (st.m === 'first_5' || st.m === 'rest') throw new Error('Customers were already told their access is on, so the grants can no longer be undone.')
      st.revert = st.g === 'rest' ? f.revert_rest : f.revert_first_5
      add(st.revert.audit)
      st.g = 'reverted'
      st.m = 'none'
      st.closed = false
      return st.revert.data
    }
    const stage = body.stage as string
    if (kind === 'grant') {
      const next = NEXT[st.g]
      if (!next || STAGES.indexOf(stage as (typeof STAGES)[number]) < STAGES.indexOf(next as (typeof STAGES)[number])) return grantFrame(d)!.data
      if (stage !== next) throw new Error(`Approve '${label(next)}' next, not '${label(stage)}'.`)
      st.g = stage as typeof st.g
      add(f.grant[stage as (typeof STAGES)[number]].audit)
      return grantFrame(d)!.data
    }
    if (!st.messagingOn) throw new Error('Messaging is switched off. Turn it on in settings, then approve.')
    const next = NEXT[st.m]
    if (!next || STAGES.indexOf(stage as (typeof STAGES)[number]) < STAGES.indexOf(next as (typeof STAGES)[number])) return msgFrame(d)!.data
    if (stage !== next) throw new Error(`Approve '${label(next)}' next, not '${label(stage)}'.`)
    st.m = stage as typeof st.m
    add(f.messages.stages[stage].audit)
    return msgFrame(d)!.data
  }
  if (path === '/api/incidents/INC-1/verify') {
    const fr = st.g === 'none' || st.g === 'reverted' || st.g === 'drafted' ? f.verify_none : st.g === 'dry_run' ? f.verify_dry_run : st.g === 'first_5' ? f.verify_first_5
      : st.mode !== 'ok' ? f.verify_401 : st.hours < 24 ? f.verify_notyet : f.verify_closed
    if (fr === f.verify_closed && !st.closed) {
      st.closed = true
      add(fr.audit)
    }
    return fr.data
  }
  if (path === '/merchant-mock/webhook-mode') {
    st.mode = String(body.mode)
    return f.hook_ok.data
  }
  if (path === '/api/clock/advance') {
    if (body.incident === 'INC-2') {
      if (dp.k < 15) throw new Error('In the hosted demo, refund all the customers first, then move the clock. The live version lets you move it any time.')
      dp.h += Number(body.hours)
    } else if (body.incident === 'INC-3') {
      if (c3.l !== 'rest') throw new Error('In the hosted demo, send all the links first, then move the clock. The live version lets you move it any time.')
      c3.lh += Number(body.hours)
    } else if (/^INC-[45]$/.test(String(body.incident ?? ''))) z.hours += Number(body.hours)
    else st.hours += Number(body.hours)
    st.audit.push({ id: st.nextId++, at: clockNow(), actor: 'system', kind: 'action', ref_id: null, summary: `Demo clock moved forward ${body.hours} hours.` } as Audit)
    return { now: clockNow() }
  }
  if (path === '/api/settings') {
    st.messagingOn = Boolean(body.messaging_enabled)
    return settings(d)
  }
  const inb = path.match(/^\/api\/inbound\/(\w+)$/)
  if (inb) {
    const pub = (body.context as { public_thread?: string } | undefined)?.public_thread
    return pub ? publicFollowUp(d, pub) : inbound(d, inb[1], String(body.text ?? ''))
  }
  const rep = path.match(/^\/api\/threads\/(thr_\w+)\/(reply|handoff)$/)
  if (rep) {
    if (rep[2] === 'handoff') throw new Error('Taking over a conversation works in the live demo.')
    if (body.body) throw new Error('Writing your own reply works in the live demo.')
    const sc = d.chat[st.byThread[rep[1]]]
    if (!sc?.approve) throw new Error('There is no draft to approve.')
    st.threads[rep[1]] = sc.approve
    return sc.approve
  }
  throw new Error(`The hosted demo does not do ${method} ${path}. Run it live to try that.`)
}

function inbound(d: Demo, channel: string, text: string) {
  const open = Object.values(d.chat).find((s) => s.channel === channel && st.byThread[s.steps[0].step.thread.id] === s.id && st.threads[s.steps[0].step.thread.id]?.state === 'identify'
    && s.steps[1]?.customer === text)
  const sc = open ?? Object.values(d.chat).find((s) => s.channel === channel && (s.steps[0].customer === text || (channel === 'email' && s.id === 'email')))
  if (!sc) throw new Error('In the hosted demo, pick one of the suggested messages. The live version accepts anything.')
  const idx = open ? 1 : 0
  const step = sc.steps[idx].step
  const id = step.thread.id
  if (!st.byThread[id]) st.order.unshift(id)
  st.byThread[id] = sc.id
  st.threads[id] = step.thread
  return step
}

// The customer answers a public reply by writing privately: the public thread closes and the private one carries on, both as recorded.
function publicFollowUp(d: Demo, publicThread: string) {
  const sc = d.chat[st.byThread[publicThread]]
  if (!sc?.follow_up) throw new Error('In the hosted demo, only a post with a recorded private follow-up can be answered. Run it live to try any post.')
  const f = sc.follow_up
  st.threads[publicThread] = f.public_after
  const id = f.step.thread.id
  st.order.unshift(id)
  st.byThread[id] = sc.id
  st.threads[id] = f.step.thread
  return f.step
}

export async function demoSuggestions(channel: string, tid?: string): Promise<string[]> {
  const d = await demo()
  const sc = tid ? d.chat[st.byThread[tid]] : undefined
  if (sc && sc.steps.length > 1 && st.threads[tid!]?.state === 'identify') return [sc.steps[1].customer]
  return Object.values(d.chat).filter((s) => s.channel === channel && s.id !== 'email').map((s) => s.steps[0].customer)
}

export const demoHelpPayment = async () => (await demo()).chat.help.payment_id as string

export const demoNote = 'A replay of the real engine on made-up data. Nothing here is live.'
