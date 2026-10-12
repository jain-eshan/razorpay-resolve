import { NOW } from './demo'

// The date range on Overview. In the demo "today" is the moment the data was taken (2 Oct 2026, 10:40 IST), because its payment issues date from
// 26 Sep to 1 Oct: the real clock would show an empty page. Production would use the real time.
export const RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
] as const
export type RangeId = (typeof RANGES)[number]['id']
export const DEFAULT_RANGE: RangeId = '7d'
export const parseRange = (s: string | null): RangeId => RANGES.find((r) => r.id === s)?.id ?? DEFAULT_RANGE

const IST = 'Asia/Kolkata'
const DAY = 86_400_000
// "2026-10-02": the calendar day in India, whatever the browser's timezone is.
export const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(d)
const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10)

// The first moment of the range, and its first calendar day. A range always ends now.
export function rangeStart(id: RangeId, now = NOW): Date {
  if (id === '7d') return new Date(now.getTime() - 7 * DAY)
  if (id === '30d') return new Date(now.getTime() - 30 * DAY)
  const first = id === 'month' ? `${istDay(now).slice(0, 8)}01` : istDay(now)
  return new Date(`${first}T00:00:00+05:30`)
}
export const inRange = (onset: string, id: RangeId, now = NOW) => {
  const t = new Date(onset).getTime()
  return t >= rangeStart(id, now).getTime() && t <= now.getTime()
}
// Every calendar day of the range, so a day with nothing still shows as an empty bar.
export function rangeDays(id: RangeId, now = NOW): string[] {
  const days: string[] = []
  for (let d = istDay(rangeStart(id, now)); d <= istDay(now); d = addDays(d, 1)) days.push(d)
  return days
}
// "26 Sep"
export const dayShort = (day: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`)).replace('Sept', 'Sep')
