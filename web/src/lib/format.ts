import { account } from './account'

const IST = 'Asia/Kolkata'

// Times arrive with an IST offset. Always show IST, whatever the browser's timezone is.
export const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: false, timeZone: IST })
    .format(new Date(iso))
    .replace(',', '')
    .replace('Sept', 'Sep')

export const hourLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', hour12: false, timeZone: IST }).format(new Date(iso)).replace(',', '').replace('Sept', 'Sep') + ':00'

// Raw values arrive as snake_case ("tool_call", "upi"). Show them as a sentence.
// The engine keeps real identifiers out of stored text and leaves a token such as [RRN_1]. A person reads that as an error, so show it in words.
const TOKEN_WORDS: Record<string, string> = { PAYMENT_ID: 'payment ID', ORDER_ID: 'order ID', RRN: 'UPI reference', PHONE: 'phone number', EMAIL: 'email address', VPA: 'UPI ID', CARD4: 'last four digits' }
export const plainTokens = (s: string) =>
  s.replace(/\[([A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)*)_\d+\]/g, (m, k: string, at: number, whole: string) => (TOKEN_WORDS[k] ? (/\b(?:ref|reference|id|number)\s*$/i.test(whole.slice(0, at)) ? '(hidden)' : `${TOKEN_WORDS[k]} (hidden)`) : m)).replaceAll('[REMOVED]', '(removed for safety)')

export const sentence = (s: string) => {
  const t = s.replaceAll('_', ' ').replace(/\bupi\b/g, 'UPI')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const CHANNEL: Record<string, string> = { help_button: 'Help button on Razorpay pages', whatsapp_payments: 'WhatsApp payments number', email: 'Email', ig_dm: 'Instagram DMs', fb_dm: 'Messenger',
  public_mention: 'Public mentions', ray_forward: 'Forward from Ray', paste: 'Paste a complaint', csv: 'Upload a CSV' }

// Whose side the cause is on, in the merchant's words.
export const OWNER: Record<string, string> = {
  merchant_code: 'Your code',
  merchant_config: 'Your settings',
  razorpay: 'Razorpay',
  bank: 'The bank',
  customer: 'The customer',
  unknown: 'Not sure yet',
}
// "Estimated" when no payment exists to look up (the customer never reached checkout), so the cause is worked out from other signals.
export const cause = (i: { owner: string; inferred: boolean }) => `${OWNER[i.owner]}${i.inferred ? ' · estimated' : ''}`

export const ZONE: Record<string, string> = { before: 'Before payment', during: 'During payment', after: 'After payment' }
export const ZONE_LINE: Record<string, string> = {
  before: 'Customers could not pay, so Razorpay never saw an attempt',
  during: 'Bank and UPI failures',
  after: 'Customers paid, then something went wrong',
}

// What happened to customers, as a merchant would say it. The engine's title says the technical cause and sits under this one.
// The brand account's issues carry their own headline (`synth/brand_world.py`), in the same voice.
export const headline = (i: { mismatch_type: string; affected: number; title: string; headline?: string }) => i.headline ??
  ({
    A: `${i.affected} customers paid and did not get access`,
    E: `${i.affected} customers were charged twice`,
    G: `${i.affected} card renewals failed on Razorpay's side`,
    Z1: `About ${i.affected} customers could not pay`,
  })[i.mismatch_type] ?? i.title

// The kind of issue as a name, with no count: a chart legend groups several issues of one kind, so the count in `headline()` would be wrong there.
// A customer of a shopping app who paid gets an order, not access, so the same kind reads in that merchant's words.
export const KIND: Record<string, string> = { A: 'Paid, no access', B: 'Told failed, money taken', E: 'Charged twice', G: 'Razorpay renewals', Z1: 'Could not pay' }
export const kindName = (mismatchType: string) => (mismatchType === 'A' && account().gets === 'order' ? 'Paid, no order' : KIND[mismatchType] ?? 'Other')

export const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: IST }).format(new Date(iso)).replace(',', '').replace('Sept', 'Sep')

// Whose money the amount is, since it is not always every customer's in the row: for a webhook issue it is what the customers still without access paid.
export const AMOUNT_NOTE: Record<string, string> = { A: 'paid by those still without access', E: 'still to refund', G: 'still to collect', Z1: 'estimated, still reachable' }
// The same note in a shopping app's words (orders, not access).
const AMOUNT_NOTE_ORDER: Record<string, string> = { A: 'paid, order not confirmed', B: 'paid, no order confirmed', E: 'still to refund' }
export const amountNote = (mismatchType: string): string | undefined => (account().gets === 'order' ? AMOUNT_NOTE_ORDER : AMOUNT_NOTE)[mismatchType]

// The x value of the bucket that holds a moment, for marking it on a chart of hourly or daily buckets. A moment before the first bucket or after the last has none, so no
// mark is drawn outside the chart.
export const bucketAt = (starts: string[], iso: string | null | undefined, label: (start: string) => string): string | undefined => {
  if (!iso || starts.length === 0) return undefined
  const t = new Date(iso).getTime(), at = starts.map((s) => new Date(s).getTime())
  const width = at.length > 1 ? at[1] - at[0] : 3_600_000
  let hit = -1
  at.forEach((s, i) => { if (s <= t) hit = i })
  return hit >= 0 && t < at[hit] + width ? label(starts[hit]) : undefined
}

// Marks on a chart are labelled, but two marks a few buckets apart would print their labels over each other (a start and a fix an hour and a half apart on a 24 hour
// chart are 35px apart), and a label on one of the last few buckets runs out of the plot (on a phone, the pill is cut by the edge). The later mark keeps its line and
// loses its label in both cases; `full` keeps what it said, and ChartKey prints it under the chart so nothing is lost.
export const thinLabels = (lines: { x: string; label: string }[], categories: string[]) => {
  const near = Math.max(4, Math.ceil(categories.length / 8))
  const edge = Math.max(2, Math.ceil(categories.length / 10))
  const sorted = [...lines].sort((a, b) => categories.indexOf(a.x) - categories.indexOf(b.x))
  return sorted.map((l, i) => {
    const crowded = i > 0 && categories.indexOf(l.x) - categories.indexOf(sorted[i - 1].x) < near
    const atEdge = categories.length - 1 - categories.indexOf(l.x) < edge
    return { ...l, full: l.label, label: crowded || atEdge ? '' : l.label }
  })
}
// What a mark that lost its label said, for the note under the chart.
export const droppedMarks = (lines: { x: string; full: string; label: string }[]) => lines.filter((l) => !l.label && l.full).map((l) => `${l.full}, ${l.x}`)

// The top of a chart's value axis: room above the tallest bar, in three equal steps of a round whole number (0, 10, 20, 30 and not 0, 15, 32), so the gridlines read.
export const yTop = (max: number) => {
  const need = Math.max(2, Math.ceil((max * 1.2) / 3))
  for (let k = 1; ; k *= 10) for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) { const step = m * k; if (Number.isInteger(step) && step >= need) return step * 3 }
}
