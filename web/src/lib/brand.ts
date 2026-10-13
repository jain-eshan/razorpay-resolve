import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Schemas } from './api'
import type { Row } from '../components/EvidenceLane'

// The big-brand demo (PRD v3, journey J2). The store is named after Flipkart, in text only: no logo, no look-alike screens (Eshan, 12 Oct 2026: a demo for the Razorpay team, not for
// production). The name lives here and nowhere else, so changing it is one line.
export const BRAND = 'Flipkart'

// Everything the demo screens show comes from `web/public/brand/j2.json`, which `synth/j2_brand.py` writes with a fixed seed. It is not in `public/snapshot`, because
// `make snapshot` empties that folder.
export type J2Customer = {
  payment_id: string; customer: string; at: string; amount_paise: number; upi_app: string; bank: string; region: string
  outcome: 'paid_twice' | 'no_order'; second_payment_id?: string; second_at?: string; order_id?: string
}
export type J2 = {
  app_version: string; previous_version: string; platform: string; day: string
  timeline: Record<'axis_from' | 'axis_to' | 'rollout' | 'verify_stops' | 'errors_start' | 'alert' | 'rca' | 'signoff' | 'rollback', string>
  baseline_minutes: number
  counts: { affected: number; paid_twice: number; no_order: number; second_payments: number; sentry_events: number; baseline_payments: number }
  money_paise: { stuck: number; paid_twice: number; no_order: number }
  sentry: { issue: string; service: string; window_minutes: number; events: number; per_minute: { at: string; events: number }[] }
  lift: (Omit<Schemas['LiftRow'], 'lift'> & { lift: number | null })[]
  signals: string[]
  sample_payment_ids: string[]
  customers: J2Customer[]
}

let cache: Promise<J2> | undefined
const load = () => (cache ??= fetch('/brand/j2.json').then((r) => { if (!r.ok) throw new Error(`${r.status} /brand/j2.json`); return r.json() as Promise<J2> }))

export function useJ2() {
  const [res, setRes] = useState<{ data?: J2; error?: string }>({})
  useEffect(() => {
    let live = true
    load().then((data) => live && setRes({ data }), (e: Error) => { cache = undefined; if (live) setRes({ error: e.message }) })
    return () => { live = false }
  }, [])
  return res
}

// The brand's other issues (`web/public/brand/issues.json`, from `synth/brand_issues.py`): the list on /demo/issues and one page each. J2 above is the headline story with its own four screens.
export type IssueAction = { id: string; title: string; text: string; button: string; kind: 'fix' | 'tell'; covers: number }
export type IssueGroup = { id: string; label: string; hint: string; what: string; note: string; count: number; money_paise: number }
export type IssueCustomer = { id: string; name: string; at: string; amount_paise: number; region: string; group: string; detail: string }
export type BrandIssueData = {
  id: string; short: string; headline: string; cause: string; fix: string; owner: 'bank' | 'merchant_code' | 'merchant_config' | 'razorpay'; zone: 'before' | 'after'; inferred: boolean; confidence: string
  signals: string[]; started_at: string; alert_at: string; rca_at: string; axis_from: string; axis_to: string; counts: { affected: number; complained: number }; money_paise: number
  money_hint: string; amount_label: string; groups: IssueGroup[]; banner: { title: string; text: string }; rows: Row[]; lift: J2['lift']; cannot_see: string; compared: string
  actions: IssueAction[]; closing: string; sample_payment_ids: string[]; sample_note: string; customers: IssueCustomer[]
}
let issuesCache: Promise<BrandIssueData[]> | undefined
const loadIssues = () => (issuesCache ??= fetch('/brand/issues.json').then((r) => { if (!r.ok) throw new Error(`${r.status} /brand/issues.json`); return r.json() as Promise<{ issues: BrandIssueData[] }> }).then((d) => d.issues))

export function useBrandIssues() {
  const [res, setRes] = useState<{ data?: BrandIssueData[]; error?: string }>({})
  useEffect(() => {
    let live = true
    loadIssues().then((data) => live && setRes({ data }), (e: Error) => { issuesCache = undefined; if (live) setRes({ error: e.message }) })
    return () => { live = false }
  }, [])
  return res
}

const IST = 'Asia/Kolkata'
// "7:52 pm", in India's time whatever the browser's timezone is.
export const clock = (iso: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }).format(new Date(iso)).replace(/\s?([AP]M)/i, (_, m: string) => ` ${m.toLowerCase()}`)
export const minutesBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000)

// What the people in the demo have approved, shared by the Slack thread and the issue page so an approval in one shows in the other. It is the browser's, for this tab: nothing is
// sent, refunded or messaged (the demo has no server), and "Start again" on the demo bar clears it. sessionStorage when there is one, memory when there is not (a private window).
export const STEPS = ['refund', 'orders', 'message'] as const
export type Step = (typeof STEPS)[number]
const KEY = 'blindspot.demo.approved'
const read = (): Step[] => { try { return STEPS.filter((s) => (JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[]).includes(s)) } catch { return [] } }
let approved: Step[] = read()
const listeners = new Set<() => void>()
const set = (next: Step[]) => {
  approved = next
  try { sessionStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private window: it lives in memory until the tab closes */ }
  listeners.forEach((l) => l())
}
// The message to customers goes out only after the brand has confirmed the orders: telling a customer "your order is confirmed" before it is would be false.
export const canApprove = (s: Step, done: Step[]) => !done.includes(s) && (s !== 'message' || done.includes('orders'))
export const approve = (s: Step) => { if (canApprove(s, approved)) set([...approved, s]) }
export const startAgain = () => { set([]); setIssues({}) }
export const useApproved = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => approved)

// The same for the other issues, one list of approved action ids for each issue. Nothing is sent: "Start again" clears it and so does closing the tab.
const ISSUE_KEY = 'blindspot.demo.issues'
const NONE: string[] = []
const readIssues = (): Record<string, string[]> => { try { return JSON.parse(sessionStorage.getItem(ISSUE_KEY) ?? '{}') as Record<string, string[]> } catch { return {} } }
let issueApproved = readIssues()
const setIssues = (next: Record<string, string[]>) => {
  issueApproved = next
  try { sessionStorage.setItem(ISSUE_KEY, JSON.stringify(next)) } catch { /* private window: it lives in memory until the tab closes */ }
  listeners.forEach((l) => l())
}
// As with the three steps above: the message to customers waits until everything the brand has to do first is approved.
export const canApproveAction = (actions: IssueAction[], id: string, done: string[]) => {
  const a = actions.find((x) => x.id === id)
  return !!a && !done.includes(id) && (a.kind !== 'tell' || actions.filter((x) => x.kind === 'fix').every((x) => done.includes(x.id)))
}
export const approveAction = (actions: IssueAction[], issue: string, id: string) => { const done = issueApproved[issue] ?? NONE; if (canApproveAction(actions, id, done)) setIssues({ ...issueApproved, [issue]: [...done, id] }) }
export const useIssueApproved = (issue: string) => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => issueApproved[issue] ?? NONE)
// One snapshot of all of them, for the list.
export const useAllIssueApproved = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => issueApproved)
