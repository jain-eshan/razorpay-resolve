import { useSyncExternalStore } from 'react'

// Approvals on the brand account's payment issues (its engine is not built yet, so they are this tab's only): which action of which issue was approved here. Nothing is refunded
// or sent. sessionStorage when there is one, memory when the browser refuses it. "Start again" on an issue clears that issue's approvals.
const KEY = 'blindspot.brand.approved'
const read = (): string[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[] } catch { return [] } }
let approved: string[] = read()
const listeners = new Set<() => void>()
const set = (next: string[]) => {
  approved = next
  try { sessionStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private window: memory only */ }
  listeners.forEach((l) => l())
}
const k = (issue: string, action: string) => `${issue}:${action}`
export const approve = (issue: string, action: string) => { if (!approved.includes(k(issue, action))) set([...approved, k(issue, action)]) }
export const startAgain = (issue: string) => set(approved.filter((a) => !a.startsWith(`${issue}:`)))
// The ids of the actions approved on this issue.
export function useApproved(issue: string): string[] {
  const all = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => approved)
  return all.filter((a) => a.startsWith(`${issue}:`)).map((a) => a.slice(issue.length + 1))
}
