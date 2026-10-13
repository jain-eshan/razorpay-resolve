import { expect, test, type Page } from '@playwright/test'

// R2 screens against the live API on a fresh world. The tests share state, so they run in order.
test.describe.configure({ mode: 'serial' })

const panel = (page: Page) => page.getByTestId('fix-panel')
const btn = (page: Page, name: string | RegExp) => panel(page).getByRole('button', { name })
const total = async (page: Page) => Number((await panel(page).getByText(/^\d+ customers, ₹/).innerText()).match(/^(\d+)/)![1])

async function planAndRunFirstFive(page: Page) {
  await btn(page, 'Run the check').click()
  await expect(panel(page).getByText(/Your app answered/)).toBeVisible()
  await btn(page, 'Plan the fix').click()
  await expect(panel(page).getByText(/^\d+ customers, ₹/)).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').dblclick() // a double click must not grant twice
}

test('S-05 undo puts every record back, and a second plan runs again', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  await planAndRunFirstFive(page)
  await expect(panel(page).getByText(/^5 of \d+ confirmed active by your records/)).toBeVisible()
  await btn(page, 'Undo these changes').click()
  await expect(panel(page).getByText(/Undone\. Every record is back to how it was/)).toBeVisible()
  await page.getByText(/^Certain \(/).click()
  await expect(page.getByText(/^Certain \(\d+\)/)).not.toHaveText('Certain (0)')
})

test('S-05 to S-08 Hero A runs end to end in under 90 seconds of clicking', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  const start = Date.now()
  await btn(page, 'Run the check').click()
  await expect(panel(page).getByText(/Your app answered/)).toBeVisible()
  await btn(page, 'Plan the fix').click()
  const n = await total(page)
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await expect(panel(page).getByText(new RegExp(`^5 of ${n} confirmed active`))).toBeVisible()
  await btn(page, /^Grant the rest/).click()
  await expect(panel(page).getByText(new RegExp(`^${n} of ${n} confirmed active`))).toBeVisible()

  // S-06 message preview in the merchant's voice, with a language toggle
  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/From Kaksha payment help, powered by Razorpay/).first()).toBeVisible()
  await expect(panel(page).getByText('utility').first()).toBeVisible()
  await panel(page).getByText('Hinglish', { exact: true }).click()
  await expect(panel(page).getByText(/chalu/).first()).toBeVisible()
  await expect(panel(page).getByText(/Written from a template/)).toBeVisible()
  await btn(page, 'Switch messaging on').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, /^Grant the rest/).click()
  await expect(panel(page).getByText('Sent', { exact: true })).toBeVisible()

  // Closing needs the webhook fix and 24 healthy hours. Until then the page says what is missing.
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/still answers 401/)).toBeVisible()
  await btn(page, 'Your developer ships the fix').click()
  await btn(page, 'Move the clock forward 24 hours').click()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(new RegExp(`^${n} of ${n} confirmed active by your records. Your webhook has answered normally for 24 hours. ₹[\\d,]+ restored`))).toBeVisible()

  // S-08 the one RazorSense moment, with its static tint behind it
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(page.getByTestId('success-moment').getByText(new RegExp(`${n} customers have access again`))).toBeVisible()
  // One RazorSense surface on the screen. The rule is about what is shown: Blade keeps a canvas in the page but hides it (display none) when the device is too slow, and a slow CI runner
  // did that to a second one (CI run 38222656443 counted two, a laptop with the browser slowed six times counted one). Wait for the steady state, count the shown ones, and if two
  // are still shown say where each sits, because that run could not be reproduced here.
  const canvases = () => page.locator('canvas').evaluateAll((els) => els.map((c) => ({ shown: getComputedStyle(c).display !== 'none', size: `${c.clientWidth}x${c.clientHeight}`, inside: c.closest('[data-testid]')?.getAttribute('data-testid') ?? 'none' })))
  try {
    await expect.poll(async () => (await canvases()).filter((c) => c.shown).length, { message: 'canvases shown on the page (rule: at most one RazorSense surface)' }).toBeLessThanOrEqual(1)
  } catch (e) {
    throw new Error(`${(e as Error).message}\ncanvases: ${JSON.stringify(await canvases())}`)
  }
  expect(Date.now() - start).toBeLessThan(90_000)
  await expect(page.getByText('Undo these changes')).toHaveCount(0) // customers were told, so undo is closed
})

test('S-07 developer handoff is read-only and exports JSON and CSV', async ({ page }) => {
  await page.goto('/incidents/INC-1/dev')
  await expect(page.getByRole('heading', { name: 'For your developer' })).toBeVisible()
  await expect(page.getByText(/Read-only\. Opening this page changes nothing/)).toBeVisible()
  await expect(page.getByText(/guard on the event ID/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Plan|Approve|Grant)/ })).toHaveCount(0)
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
  expect(csv.suggestedFilename()).toMatch(/^MG-INC-1-[0-9A-F]{4}\.csv$/)
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()])
  expect(json.suggestedFilename()).toMatch(/\.json$/)
})

test('S-09 audit log shows who approved what', async ({ page }) => {
  await page.goto('/audit')
  await expect(page.getByText(/Planned grant for \d+ customers/).first()).toBeVisible()
  await expect(page.getByText(/Approved first 5: 5 of \d+ done and confirmed/).first()).toBeVisible()
  await expect(page.getByText(/Undid the grants/)).toBeVisible()
  await expect(page.getByText(/merchant:founder/).first()).toBeVisible()
})

// INC-3 against the real engine: access kept in stages (repeat approvals are covered in the engine tests and the eval), the pack drafted then sent only on approval, then closed.
test('INC-3 live: grace in stages, the pack waits for the founder, and it closes', async ({ page }) => {
  await page.goto('/incidents/INC-3')
  await expect(page.getByText("This one is on Razorpay's side")).toBeVisible()
  await btn(page, 'Plan the extension').click()
  await expect(panel(page).getByText(/^24 customers, ₹7,176 of renewals/)).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Keep access on for the first 5').click()
  await expect(panel(page).getByText('5 of 24', { exact: true })).toBeVisible()
  await btn(page, /^Keep access on for the rest/).click()
  await expect(panel(page).getByText('Done', { exact: true })).toBeVisible()

  await btn(page, 'Draft the evidence pack').click()
  await expect(panel(page).getByText(/Reference MG-INC-3-/)).toBeVisible()
  await expect(panel(page).getByText(/Sent to Razorpay \(simulated\)/)).toHaveCount(0) // drafted, not sent
  await btn(page, 'Send to Razorpay').click()
  await expect(panel(page).getByText(/Sent to Razorpay \(simulated\) as MG-INC-3-/)).toBeVisible()

  await btn(page, 'Check it held and close').click()
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(panel(page).getByText(/24 of 24 confirmed to have access by your records/).first()).toBeVisible()
})

// INC-3 renewal links against the real engine: the link follows the message that promised it, goes out in stages with 2 customers held back, and verify counts who renewed.
test('INC-3 live: the renewal link follows the message, goes out in stages, and verify counts who renewed', async ({ page }) => {
  await page.goto('/incidents/INC-3')
  await expect(btn(page, 'Plan the links')).toHaveCount(0) // nobody has been told a link is coming yet
  await btn(page, 'Preview the message').click()
  const on = btn(page, 'Switch messaging on')
  if (await on.count()) await on.click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Send the first 5').click()
  await btn(page, 'Send the rest').click()
  await expect(panel(page).getByText('Sent', { exact: true })).toBeVisible()

  await btn(page, 'Plan the links').click()
  await expect(panel(page).getByText(/^24 customers, 2 of them held back on purpose/)).toBeVisible()
  await expect(panel(page).getByText(/payment network issue is fixed/).first()).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Send the first 5').click()
  await btn(page, /^Send the rest/).click()
  await expect(panel(page).getByText(/^0 of 22 customers with a link have renewed/)).toBeVisible()
  await btn(page, 'Move the demo clock forward 48 hours').click()
  await expect(panel(page).getByText(/^12 of 22 customers with a link have renewed, ₹3,588 collected/)).toBeVisible()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/Renewed since: 12 of 24 customers/).first()).toBeVisible()
})

// INC-2 against the real engine: the list waits for approval, each refund is one click on one customer, the daily limit stops the one that would pass it, and the incident closes.
test('INC-2 live: refunds one customer at a time, the daily limit holds, and it closes', async ({ page, request }) => {
  const api = 'http://localhost:8000'
  const settings = await (await request.get(`${api}/api/settings`)).json()
  await page.goto('/incidents/INC-2')
  await expect(page.getByText('Your webhook was fine. The second charge is the problem')).toBeVisible()
  await btn(page, 'Plan the refunds').click()
  await expect(panel(page).getByText(/^15 customers, ₹4,985 to go back/)).toBeVisible()
  await expect(btn(page, /^Refund ₹/).first()).toBeDisabled()
  await btn(page, 'Looks right, continue').click()

  await request.put(`${api}/api/settings`, { data: { ...settings, daily_refund_cap_paise: 100_000 } }) // Rs 1,000 a day
  await page.goto('/incidents/INC-2')
  let made = 0
  for (let i = 1; i <= 15; i++) {
    await btn(page, /^Refund ₹/).first().click()
    const stopped = panel(page).getByText(/refund limit is ₹1,000/)
    await expect(stopped.or(panel(page).getByText('Pending', { exact: true }).nth(i - 1))).toBeVisible() // either the refund went through or the limit said no
    if (await stopped.isVisible()) break
    made = i
  }
  expect(made, 'the limit must stop it before the 15th').toBeLessThan(15)
  expect(made).toBeGreaterThan(0)
  await expect(panel(page).getByText(/waits for tomorrow or a higher limit/)).toBeVisible()

  await request.put(`${api}/api/settings`, { data: { ...settings, daily_refund_cap_paise: 500_000 } })
  await page.goto('/incidents/INC-2')
  await expect(btn(page, /^Refund ₹/).first()).toBeVisible() // the list has loaded
  while ((await btn(page, /^Refund ₹/).count()) > 0) {
    const left = await btn(page, /^Refund ₹/).count()
    await btn(page, /^Refund ₹/).first().click()
    await expect(btn(page, /^Refund ₹/)).toHaveCount(left - 1)
  }
  await expect(panel(page).getByText('15 refunds started')).toBeVisible()
  await btn(page, 'Your developer ships the fix').click()
  for (const h of [72, 24]) await btn(page, `Move the clock forward ${h} hours`).click()
  await expect(panel(page).getByText('Processed', { exact: true })).toHaveCount(15)
  await btn(page, 'Check it held and close').click()
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(panel(page).getByText(/₹4,985 returned/).first()).toBeVisible()
})

test('S-11 autonomy dial and limits are saved', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText('You approve every step: the test run, the first 5, the rest, and every message.')).toBeVisible()
  await page.getByText('Approve once', { exact: true }).click()
  await expect(page.getByText(/You approve a fix once/)).toBeVisible()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText(/Saved/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/You approve a fix once/)).toBeVisible()
  await page.goto('/audit')
  await expect(page.getByText(/Changed autonomy from suggest to assist/)).toBeVisible()
})
