// The guided demo. The hosted site has no server, so every call the screens make is answered here from frames recorded from the real
// engine (scripts/demo_script.py -> /snapshot/demo.json). This file only decides which recorded frame comes next; it writes no
// text of its own except error messages that mirror the server's.
import type { Schemas } from './api'

type Audit = Schemas['AuditEntry']
type Frame<T = unknown> = { data: T; audit: Audit[] }
type Action = Schemas['Action']
type Detail = Schemas['ThreadDetail']
type Scenario = { id: string; channel: string; steps: { customer: string; step: Schemas['ThreadStep'] }[]; approve?: Detail; payment_id?: string }
type Demo = {
  fix: {
    grant: Record<'drafted' | 'dry_run' | 'first_5' | 'rest', Frame<Action>>
    messages: { blocked: Record<string, Frame<Action>>; ready: Record<string, Frame<Action>>; previews: Record<string, unknown>; stages: Record<string, Frame<Action>> }
    verify_none: Frame; verify_dry_run: Frame; verify_first_5: Frame; verify_401: Frame; verify_notyet: Frame; verify_closed: Frame
    hook_broken: Frame; hook_ok: Frame; hook_ok24: Frame; revert_first_5: Frame<Action>; revert_rest: Frame<Action>; settings: Schemas['Settings']
  }
  chat: Record<string, Scenario>
}

const STAGES = ['dry_run', 'first_5', 'rest'] as const
const NEXT: Record<string, string | undefined> = { drafted: 'dry_run', dry_run: 'first_5', first_5: 'rest' }
const NOW = new Date('2026-10-02T10:40:00+05:30')
const label = (s: string) => s.replace('_', ' ')

const st = {
  g: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest' | 'reverted',
  m: 'none' as 'none' | 'drafted' | 'dry_run' | 'first_5' | 'rest',
  lang: 'auto', messagingOn: false, mode: '401', hours: 0, closed: false,
  revert: undefined as Frame<Action> | undefined,
  audit: [] as Audit[], nextId: 1,
  threads: {} as Record<string, Detail>, order: [] as string[], byThread: {} as Record<string, string>,
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
  if (p === '/api/settings') return settings(d)
  if (p.startsWith('/api/actions/')) {
    const f = p.endsWith('_message') ? msgFrame(d) : grantFrame(d)
    if (!f) throw new Error('404 action')
    return f.data
  }
  if (p === '/api/messages/preview') return d.fix.messages.previews[st.lang]
  if (p === '/api/incidents/INC-1') return incident(d)
  if (p === '/api/incidents/INC-1/members') {
    const tier = new URLSearchParams(q).get('tier')
    return (await members(d)).filter((m) => !tier || m.tier === tier)
  }
  if (p === '/api/audit') return [...st.audit].reverse()
  if (p === '/api/threads') return st.order.map((id) => st.threads[id])
  if (p.startsWith('/api/threads/')) return st.threads[p.split('/')[3]]
  return undefined
}

export async function demoSend(method: string, path: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const d = await demo()
  const f = d.fix
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
    st.hours += Number(body.hours)
    st.audit.push({ id: st.nextId++, at: clockNow(), actor: 'system', kind: 'action', ref_id: null, summary: `Demo clock moved forward ${body.hours} hours.` } as Audit)
    return { now: clockNow() }
  }
  if (path === '/api/settings') {
    st.messagingOn = Boolean(body.messaging_enabled)
    return settings(d)
  }
  const inb = path.match(/^\/api\/inbound\/(\w+)$/)
  if (inb) return inbound(d, inb[1], String(body.text ?? ''))
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

export async function demoSuggestions(channel: string, tid?: string): Promise<string[]> {
  const d = await demo()
  const sc = tid ? d.chat[st.byThread[tid]] : undefined
  if (sc && sc.steps.length > 1 && st.threads[tid!]?.state === 'identify') return [sc.steps[1].customer]
  return Object.values(d.chat).filter((s) => s.channel === channel && s.id !== 'email').map((s) => s.steps[0].customer)
}

export const demoHelpPayment = async () => (await demo()).chat.help.payment_id as string

export const demoNote = 'Guided demo: replayed from a real run of the engine on the synthetic world. Nothing here is live.'
