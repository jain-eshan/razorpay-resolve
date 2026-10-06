import { expect, test } from '@playwright/test'

// Smoke tests for the R1 screens. They read the snapshot written by `make snapshot` (real pipeline output), so they assert shapes, not exact counts.

test('S-01 RAY alert says how many customers were affected', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'RAY on WhatsApp' })).toBeVisible()
  await expect(page.getByText(/\d+ customer affected so far/)).toBeVisible()
  await expect(page.getByText(/Your server returned 401 to Razorpay from/)).toBeVisible()
})

test('S-02 inbox groups incidents by zone and opens one', async ({ page }) => {
  await page.goto('/incidents')
  await expect(page.getByText('After the payment')).toBeVisible()
  await page.getByText(/Webhook returned 401/).first().click()
  await expect(page).toHaveURL(/\/incidents\/INC-1$/)
})

test('S-03 incident page: numbers add up, tiers switch, replay limits shown', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  await expect(page.getByText(/Your side · Code/)).toBeVisible()
  const n = async (label: string) => Number((await page.getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]').innerText()).replace(/\D/g, ''))
  expect((await n('Complained')) + (await n('Silent'))).toBe(await n('Affected'))
  await expect(page.getByText('Can Razorpay replay these?')).toBeVisible()
  await expect(page.getByText(/by a support ticket, one event at a time/)).toBeVisible()
  await page.getByText(/^Excluded \(/).click()
  await expect(page.getByText(/refunded|already active/).first()).toBeVisible()
})

test('S-17 day-0 scan states what it found', async ({ page }) => {
  await page.goto('/scan')
  await expect(page.getByText(/I found \d+ customers in the last 30 days who paid and have no access/)).toBeVisible()
})

test('S-10 how we know shows every gate passing', async ({ page }) => {
  await page.goto('/how')
  await expect(page.getByText('silent to complained ratio')).toBeVisible()
  await expect(page.getByText('fail', { exact: true })).toHaveCount(0)
  await expect(page.getByText('pass', { exact: true }).first()).toBeVisible()
})
