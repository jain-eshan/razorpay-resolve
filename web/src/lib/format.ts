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
export const sentence = (s: string) => {
  const t = s.replaceAll('_', ' ').replace(/\bupi\b/g, 'UPI')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const CHANNEL: Record<string, string> = { help_button: 'Help button on Razorpay pages', whatsapp_payments: 'WhatsApp payments number', email: 'Email', ig_dm: 'Instagram DMs', fb_dm: 'Messenger',
  public_mention: 'Public mentions', ray_forward: 'Forward from Ray', paste: 'Paste a complaint', csv: 'Upload a CSV' }

export const OWNER: Record<string, string> = {
  merchant_code: 'Your side · Code',
  merchant_config: 'Your side · Setup',
  razorpay: 'Razorpay side',
  bank: 'Bank side',
  customer: 'Customer side',
  unknown: 'Not sure yet',
}

export const ZONE: Record<string, string> = { before: 'Before Razorpay', during: 'Inside the payment', after: 'After the payment' }

export const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: IST }).format(new Date(iso)).replace(',', '').replace('Sept', 'Sep')
