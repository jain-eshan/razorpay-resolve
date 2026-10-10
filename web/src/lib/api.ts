import { useEffect, useState } from 'react'
import type { components } from '../types/api'
import { demoGet, demoSend } from './demo'

export type Schemas = components['schemas']

// snapshot (default): static JSON written by `make snapshot`. live: the FastAPI backend.
const MODE = import.meta.env.VITE_MODE ?? 'snapshot'
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const isLive = MODE === 'live'
// Without a server the screens still work: every call is answered from frames recorded from the real engine (lib/demo.ts).
export const canAct = true

// Writes only exist in live mode. In the snapshot there is no server to change anything on.
export async function send<T>(method: 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  if (!isLive) return demoSend(method, path, body as Record<string, unknown>) as Promise<T>
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof json.detail === 'string' ? json.detail : `${res.status} ${path}`)
  return json as T
}

export async function get<T>(path: string): Promise<T> {
  if (!isLive) {
    const replay = await demoGet(path)
    if (replay !== undefined) return replay as T
  }
  const url = MODE === 'live' ? `${API}${path}` : `/snapshot/${path.replace(/^\/api\//, '').split('?')[0]}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json() as Promise<T>
}

// `version` is bumped after a write so the same path is fetched again.
export function useGet<T>(path: string | null, version = 0) {
  const [res, setRes] = useState<{ path: string; v: number; data?: T; error?: string }>()
  useEffect(() => {
    if (!path) return
    let live = true
    get<T>(path).then(
      (data) => live && setRes({ path, v: version, data }),
      (e: Error) => live && setRes({ path, v: version, error: e.message }),
    )
    return () => {
      live = false
    }
  }, [path, version])
  const cur = path && res?.path === path ? res : undefined // ignore a stale result from the previous path; keep the old data while a refetch runs
  return { data: cur?.data, error: cur?.error, busy: !!path && cur?.v !== version } // busy: the answer on screen is from an earlier run
}

// Money is integer paise. Indian digit grouping: ₹2,40,000.
export const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
