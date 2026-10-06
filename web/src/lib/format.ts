const IST = 'Asia/Kolkata'

// Times arrive with an IST offset. Always show IST, whatever the browser's timezone is.
export const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: false, timeZone: IST })
    .format(new Date(iso))
    .replace(',', '')
    .replace('Sept', 'Sep')

export const hourLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', hour12: false, timeZone: IST }).format(new Date(iso)).replace(',', '').replace('Sept', 'Sep') + ':00'

export const OWNER: Record<string, string> = {
  merchant_code: 'Your side · Code',
  merchant_config: 'Your side · Setup',
  razorpay: 'Razorpay side',
  bank: 'Bank side',
  customer: 'Customer side',
  unknown: 'Not sure yet',
}

export const ZONE: Record<string, string> = { before: 'Before Razorpay', during: 'Inside the payment', after: 'After the payment' }
