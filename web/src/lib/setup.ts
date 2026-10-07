// How far the merchant got in the first-run setup (routes/Setup.tsx). Kept in the browser only: setup has no server side in this prototype.
export const SETUP_STEPS = 3
const KEY = 'blindspot.setup'

export function setupDone(): number {
  try { return Math.min(SETUP_STEPS, Number(localStorage.getItem(KEY)) || 0) } catch { return 0 }
}

export function saveSetup(done: number) {
  try { localStorage.setItem(KEY, String(done)) } catch { /* private window: progress just resets */ }
}
