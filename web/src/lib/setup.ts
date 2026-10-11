// How far the merchant got in the first-run setup (routes/Setup.tsx). Kept in the browser only: setup has no server side in this prototype.
export const SETUP_STEPS = 3
const KEY = 'blindspot.setup'

export function setupDone(): number {
  try { return Math.min(SETUP_STEPS, Number(localStorage.getItem(KEY)) || 0) } catch { return 0 }
}

export function saveSetup(done: number) {
  try { localStorage.setItem(KEY, String(done)) } catch { /* private window: progress just resets */ }
}

// The welcome pop-up (components/WelcomeTour.tsx). In production it would show once per merchant. In the demo it shows once each time the app is
// opened or reloaded (Eshan's call, 11 Oct 2026): a judge always meets it, but it does not come back every time they return to Overview.
// A module variable resets on reload; sessionStorage would not. Browser tests run with automation on and would meet it on every load, so it stays
// shut for them unless the address has `?welcome`, which the test for the pop-up itself uses.
// Checking and marking are separate so React's double render in development does not use the flag up before the pop-up opens.
let welcomed = false
export const welcomeDue = () => !welcomed && !(navigator.webdriver && !location.search.includes('welcome'))
export const markWelcomed = () => { welcomed = true }
