import { useEffect, useState } from 'react'
import type { components } from '../types/api'

export type Schemas = components['schemas']

// snapshot (default): static JSON written by `make snapshot`. live: the FastAPI backend.
const MODE = import.meta.env.VITE_MODE ?? 'snapshot'
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function get<T>(path: string): Promise<T> {
  const url = MODE === 'live' ? `${API}${path}` : `/snapshot/${path.replace(/^\/api\//, '').split('?')[0]}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json() as Promise<T>
}

export function useGet<T>(path: string) {
  const [res, setRes] = useState<{ path: string; data?: T; error?: string }>()
  useEffect(() => {
    let live = true
    get<T>(path).then(
      (data) => live && setRes({ path, data }),
      (e: Error) => live && setRes({ path, error: e.message }),
    )
    return () => {
      live = false
    }
  }, [path])
  const cur = res?.path === path ? res : undefined // ignore a stale result from the previous path
  return { data: cur?.data, error: cur?.error }
}

// Money is integer paise. Indian digit grouping: ₹2,40,000.
export const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
