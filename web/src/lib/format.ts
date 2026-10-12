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
export const headline = (i: { mismatch_type: string; affected: number; title: string }) =>
  ({
    A: `${i.affected} customers paid and did not get access`,
    E: `${i.affected} customers were charged twice`,
    G: `${i.affected} card renewals failed on Razorpay's side`,
    Z1: `About ${i.affected} customers could not pay`,
  })[i.mismatch_type] ?? i.title

// The kind of issue as a name, with no count: a chart legend groups several issues of one kind, so the count in `headline()` would be wrong there.
export const KIND: Record<string, string> = { A: 'Paid, no access', E: 'Charged twice', G: 'Renewals failed (Razorpay)', Z1: 'Customers could not pay' }
export const kindName = (mismatchType: string) => KIND[mismatchType] ?? 'Other'

export const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: IST }).format(new Date(iso)).replace(',', '').replace('Sept', 'Sep')
