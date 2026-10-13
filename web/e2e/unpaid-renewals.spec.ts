import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Batch 1.5 T6: "Unpaid renewals" (was "Unpaid access"), a page of its own. Every figure is compared with the file the page reads.
// It left the Overview on 13 Oct: a balance owed is not a payment issue, and its row pushed the open issues below the fold.
const report = JSON.parse(readFileSync('public/snapshot/leakage.json', 'utf8'))
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)

test('T6 the page is reached from the side menu, not from the Overview', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home-cards')).toBeVisible()
  await expect(page.getByTestId('home-unpaid')).toHaveCount(0)
  await page.getByRole('link', { name: 'Unpaid renewals', exact: true }).first().click()
  await expect(page).toHaveURL(/\/access$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Unpaid renewals' })).toBeVisible()
})

test('T6 the page says how it differs from a payment issue, leads with the money, and explains when access ends', async ({ page }) => {
  await page.goto('/access')
  await expect(page.getByText(/^Not a payment issue: nothing broke\./)).toBeVisible()
  const owed = page.getByText('Owed to you', { exact: true }).locator('xpath=following-sibling::*[1]')
  await expect(owed).toHaveText(rupees(report.owed_paise))
  await expect(page.getByRole('columnheader', { name: 'Access ends on its own' }).first()).toBeVisible()
  await expect(page.getByText(/Access ends on its own at the end of the period they did not pay for, unless you end it sooner/)).toBeVisible()
  await expect(page.getByText(/\brule\b|\bleaks?\b/)).toHaveCount(0)  // the engine's words are reworded for the merchant
})
