import { expect, test, type Page } from '@playwright/test'

// R2 screens against the live API on a fresh world. The tests share state, so they run in order.
test.describe.configure({ mode: 'serial' })

const panel = (page: Page) => page.getByTestId('fix-panel')
const btn = (page: Page, name: string | RegExp) => panel(page).getByRole('button', { name })
const total = async (page: Page) => Number((await panel(page).getByText(/^\d+ customers, ₹/).innerText()).match(/^(\d+)/)![1])

async function planAndRunFirstFive(page: Page) {
  await btn(page, 'Test hook').click()
  await expect(panel(page).getByText(/Your hook answered/)).toBeVisible()
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
  await page.getByText(/^Exact \(/).click()
  await expect(page.getByText(/^Exact \(\d+\)/)).not.toHaveText('Exact (0)')
})

test('S-05 to S-08 Hero A runs end to end in under 90 seconds of clicking', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  const start = Date.now()
  await btn(page, 'Test hook').click()
  await expect(panel(page).getByText(/Your hook answered/)).toBeVisible()
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
  await btn(page, 'Verify and close').click()
  await expect(panel(page).getByText(/still answers 401/)).toBeVisible()
  await btn(page, 'Your developer ships the fix').click()
  await btn(page, 'Move the clock forward 24 hours').click()
  await btn(page, 'Verify and close').click()
  await expect(panel(page).getByText(new RegExp(`^${n} of ${n} confirmed active by your records. Your webhook has answered normally for 24 hours. ₹[\\d,]+ restored`))).toBeVisible()

  // S-08 the one RazorSense moment, with its static tint behind it
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(page.getByTestId('success-moment').getByText(new RegExp(`${n} customers have access again`))).toBeVisible()
  // One RazorSense surface on the screen. Wait for the steady state: a slow runner can show the old and new canvas together for a moment while the success card mounts.
  await expect.poll(() => page.locator('canvas').count(), { message: 'canvases on the page (rule: at most one RazorSense surface)' }).toBeLessThanOrEqual(1)
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

test('S-11 autonomy dial and limits are saved', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText('You approve every step: the dry run, the first 5, the rest, and every message.')).toBeVisible()
  await page.getByText('Assist', { exact: true }).click()
  await expect(page.getByText(/You approve a fix once/)).toBeVisible()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText(/Saved/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/You approve a fix once/)).toBeVisible()
  await page.goto('/audit')
  await expect(page.getByText(/Changed autonomy from suggest to assist/)).toBeVisible()
})
