import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Batch 1.5 T6: "Unpaid renewals" (was "Unpaid access") on the Overview and on its own page. Every figure is compared with the file the page reads.
const report = JSON.parse(readFileSync('public/snapshot/leakage.json', 'utf8'))
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
const row = (page: Page) => page.getByTestId('home-unpaid')
const size = (page: Page) => row(page).evaluate((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })

test('T6 the Overview shows what is owed from failed renewals, and it opens the page', async ({ page }) => {
  await page.goto('/')
  await expect(row(page).getByRole('heading', { name: rupees(report.owed_paise) })).toBeVisible()
  await expect(row(page)).toContainText(`owed from ${report.rows.length} failed renewals`)
  await row(page).click()
  await expect(page).toHaveURL(/\/access$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Unpaid renewals' })).toBeVisible()
})

test('T6 the brand account has no unpaid renewals row on its Overview', async ({ page }) => {
  await page.goto('/?account=flipkart')
  await expect(page.getByTestId('home-cards')).toBeVisible()
  await expect(row(page)).toHaveCount(0)
})

// DESIGN.md section 16: a card never changes size because of its data. The row is measured while its data is held back, loaded, empty and failed, at 375, 768, 1024 and 1440px.
test('T6 the Overview row is one size while loading, loaded, empty and failed', async ({ page }) => {
  const empty = { ...report, customers: 0, owed_paise: 0, longest_over_hours: 0, rows: [] }
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    let release!: () => void
    const held = new Promise<void>((r) => { release = r })
    await page.route('**/snapshot/leakage.json', async (route) => { await held; await route.continue() })
    await page.goto('/')
    await expect(row(page)).toBeVisible()
    const loading = await size(page)
    release()
    await expect(row(page).getByRole('heading', { name: rupees(report.owed_paise) })).toBeVisible()
    expect(await size(page), `loaded is the loading size at ${width}px`).toEqual(loading)
    const cut = await row(page).getByText(/^owed from/).evaluate((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 1)
    expect(cut, `the line under the amount is not cut off at ${width}px`).toBe(false)
    await page.unroute('**/snapshot/leakage.json')

    await page.route('**/snapshot/leakage.json', (route) => route.fulfill({ json: empty }))
    await page.goto('/')
    await expect(row(page)).toContainText('nobody is past your grace period')
    expect(await size(page), `empty is the loading size at ${width}px`).toEqual(loading)
    await page.unroute('**/snapshot/leakage.json')

    await page.route('**/snapshot/leakage.json', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto('/')
    await expect(row(page)).toContainText('open the page to try again')
    expect(await size(page), `failed is the loading size at ${width}px`).toEqual(loading)
    await page.unroute('**/snapshot/leakage.json')
  }
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
