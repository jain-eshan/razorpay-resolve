import type { Schemas } from './api'
import { sentence } from './format'

// "Is it just you?" in plain sentences (PRD v3, F7a). The engine already compares the affected payments with all payments on a normal day, one pattern at a time
// (`lift`: payment method, card network, error code, app version, plan, kind, how the webhook went). This turns the strongest of them into sentences, such as
// "All affected payments had a webhook that failed or was never attempted, against 0% normally." Nothing here is computed: every share is the engine's.
export type Lift = Schemas['IncidentDetail']['lift'][number]
export const STRONG = 0.2  // a pattern is strong when it covers at least 20 points more of the affected payments than it does normally
export const gap = (l: Lift) => l.share_affected - l.share_baseline
const pct = (x: number) => Number((x * 100).toFixed(x < 0.01 ? 1 : 0))

const ERROR: Record<string, string> = { GATEWAY_ERROR: 'a gateway error', BAD_REQUEST_ERROR: 'a bad request error', SERVER_ERROR: 'a server error' }
// The plans' own names (synth/config.yaml), so a sentence never shows an id such as plan_mock_199.
export const PLAN: Record<string, string> = { plan_mock_199: 'Mock Test Pack', plan_series_599: 'Test Series', plan_monthly_299: 'Premium Monthly', plan_annual_2499: 'Premium Annual' }
const METHOD: Record<string, string> = { upi: 'UPI', card: 'card', netbanking: 'net banking', wallet: 'a wallet' }
// What the pattern says about a payment, finishing the sentence "... of the affected payments ___".
const says = (l: Lift): string => {
  const v = l.value
  switch (l.dimension) {
    case 'delivery_outcome': return v === 'failed or never attempted' ? 'had a webhook that failed or was never attempted' : `had a webhook that was ${v}`
    case 'method': return `were paid by ${METHOD[v] ?? v}`
    case 'app_version': return v === 'none' ? 'came from no app version' : `came from ${/^\d/.test(v) ? 'app ' : ''}${v}`
    case 'platform': return `came from ${v}`
    case 'verify_call': return 'had no verify-payment call from your server'
    case 'kind': return `were ${v} payments`
    case 'plan': return `were for the ${PLAN[v] ?? v.replace(/^plan_/, '').replaceAll('_', ' ')} plan`
    case 'error_code': return `failed with ${ERROR[v] ?? `the error ${v}`}`
    case 'card_network': return `were on ${v} cards`
    case 'status': return `were still ${v}`
    case 'bank': return `were with ${v}`
    case 'coupon': return 'used a coupon'
    case 'checkout_method': return `tried to pay by ${METHOD[v] ?? v}`
    case 'server_release': return `came after server release ${v}`
    case 'order_payment_gap': return 'were larger than the order total'
    default: return `had ${sentence(l.dimension).toLowerCase()} ${v}`
  }
}

export const line = (l: Lift): string => {
  const all = l.share_affected >= 0.995
  return `${all ? 'All affected payments' : `${pct(l.share_affected)}% of affected payments`} ${says(l)}, against ${pct(l.share_baseline)}% normally.`
}

// The strongest patterns first, at most three. When none is strong, one is still shown, and `weak` says so, so the panel never claims a pattern that is not there.
export function justYou(lift: Lift[]): { lines: string[]; weak: boolean; sorted: Lift[] } {
  const sorted = [...lift].sort((a, b) => gap(b) - gap(a))
  const strong = sorted.filter((l) => gap(l) >= STRONG).slice(0, 3)
  return strong.length ? { lines: strong.map(line), weak: false, sorted } : { lines: sorted.slice(0, 1).map(line), weak: true, sorted }
}
