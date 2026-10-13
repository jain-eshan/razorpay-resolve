import { useSyncExternalStore } from 'react'

// Two demo merchant accounts on one Razorpay dashboard (v3, two accounts). A judge signs in as either and sees every page as that merchant would: the same product, set up
// for a small business that hears from customers, or for a big brand that hears from its own alert tools and works in Slack. Pages a merchant of that kind does not use are
// not in its menu (a shopping app has no subscription renewals). Nothing here is a real login: there is no password, and the choice lives in this tab.
export type AccountId = 'kaksha' | 'flipkart'
export type Account = {
  id: AccountId
  name: string
  kind: 'small' | 'enterprise'
  // What the company does, in a few words: the line under its name in menus and cards.
  line: string
  // A short write-up of the company, and the broad kind of person it stands for: shown where you pick the account.
  detail: string
  persona: string
  // A square picture in `public/brand/`.
  logo: string
  // What a customer gets when they pay, in the merchant's words: a test series gives access, a shopping app gives an order.
  gets: 'access' | 'order'
  mid: string
}
export const ACCOUNTS: Record<AccountId, Account> = {
  kaksha: {
    id: 'kaksha', name: 'Kaksha', kind: 'small', line: 'Test series for exam prep',
    detail: 'Kaksha sells online mock-test series to students preparing for competitive exams. Two founders run it from a website they built themselves. Students pay for a monthly or yearly plan and get access to the tests.',
    persona: 'A founder who also answers support, with no engineer on call. They find out something broke when a student writes on WhatsApp or Instagram.',
    logo: '/brand/kaksha-mark.svg', gets: 'access', mid: 'MID 8Kx2Lq0Pz',
  },
  // The name and the bag icon are Flipkart's own, so the demo reads as a real big brand (Eshan, 13 Oct 2026, after first keeping the name in text only). Every customer, payment and incident under it is made up.
  flipkart: {
    id: 'flipkart', name: 'Flipkart', kind: 'enterprise', line: 'Online marketplace',
    detail: 'Flipkart is the Bengaluru online marketplace. Here it stands in for a large brand that takes a high volume of orders through Razorpay and has its own engineering team and alert tools.',
    persona: 'A payments or platform lead with an on-call team. They already watch Sentry, Datadog and PagerDuty, and want the cause of a payment problem in the Slack channel they share with Razorpay.',
    logo: '/brand/flipkart-mark.png', gets: 'order', mid: 'MID 3Fq9Tz7Wd',
  },
}
export const BRAND = ACCOUNTS.flipkart.name

const KEY = 'blindspot.account'
const read = (): AccountId | null => {
  try { const v = sessionStorage.getItem(KEY); return v === 'kaksha' || v === 'flipkart' ? v : null } catch { return null }
}
// `?account=flipkart` in an address picks the account (links in the video and in the docs). It wins over what the tab had.
const fromAddress = (): AccountId | null => {
  try { const v = new URLSearchParams(location.search).get('account'); return v === 'kaksha' || v === 'flipkart' ? v : null } catch { return null }
}
let current: AccountId | null = fromAddress() ?? read()
// Once read, the address drops `?account`: otherwise Back after a switch would show an address that names one account while the tab is signed in as the other.
try {
  const url = new URL(location.href)
  if (url.searchParams.has('account')) { url.searchParams.delete('account'); history.replaceState(history.state, '', url.pathname + url.search + url.hash) }
} catch { /* no address to tidy */ }
const listeners = new Set<() => void>()
export function signIn(id: AccountId) {
  current = id
  try { sessionStorage.setItem(KEY, id) } catch { /* a browser that refuses storage keeps it in memory for this tab */ }
  listeners.forEach((l) => l())
}
if (current) signIn(current)

// Signed in at all? The first visit to Overview goes to the account picker; every other address opens as Kaksha, so a shared link to a page always works.
export const signedIn = () => current !== null
export const accountId = (): AccountId => current ?? 'kaksha'
export const account = (): Account => ACCOUNTS[accountId()]
export const isBrand = () => account().kind === 'enterprise'
export const useAccount = (): Account => ACCOUNTS[useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, accountId)]

// Automated browsers (the tests) open straight onto Overview as Kaksha unless the address asks for the picker (`?signin`), as the welcome pop-up does.
export const pickerDue = () => !signedIn() && !(navigator.webdriver && !location.search.includes('signin'))
