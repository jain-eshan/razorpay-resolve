import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Overview as a dashboard (v3 batch 1.1). The cards are added up in the browser from the same file the page reads, so each test adds the file up itself and compares.
type Issue = { id: string; status: string; affected: number; silent: number; fixed: number; at_risk_paise: number; onset_at: string; mismatch_type: string; owner: string }
const issues: Issue[] = JSON.parse(readFileSync('public/snapshot/incidents.json', 'utf8'))
const sum = (rows: Issue[], k: 'affected' | 'fixed' | 'at_risk_paise') => rows.reduce((a, i) => a + i[k], 0)
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
// The demo's "today" is 2 Oct 2026 10:40 IST (lib/range.ts), so "This month" starts on 1 Oct.
const thisMonth = issues.filter((i) => i.onset_at >= '2026-10-01')

const card = (page: Page, label: string) => page.getByTestId('home-cards').getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]')
async function pick(page: Page, trigger: RegExp, choice: string) {
  await page.getByRole('button', { name: trigger }).click()
  await page.getByRole('menuitem', { name: choice }).click()
}

test('H3 the four cards equal the sums from the issue data', async ({ page }) => {
  await page.goto('/?range=30d')
  const open = issues.filter((i) => i.status !== 'closed')
  await expect(card(page, 'Open payment issues')).toHaveText(String(open.length))
  await expect(card(page, 'Customers hit')).toHaveText(String(sum(issues, 'affected')))
  await expect(card(page, 'Money stuck')).toHaveText(rupees(sum(open, 'at_risk_paise')))
  await expect(card(page, 'Customers made whole')).toHaveText(String(sum(issues, 'fixed')))
})

test('H2 the date range changes the cards, chart and list together, and survives a reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Last 7 days' })).toBeVisible()  // the default
  await pick(page, /Last 7 days/, 'This month')
  await expect(page).toHaveURL(/range=month/)
  await expect(card(page, 'Customers hit')).toHaveText(String(sum(thisMonth, 'affected')))
  await expect(page.getByTestId('home-issues').getByRole('link')).toHaveCount(thisMonth.length)
  await expect(page.getByTestId('issues-chart').getByText('1 Oct', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'This month' })).toBeVisible()
  await expect(card(page, 'Customers hit')).toHaveText(String(sum(thisMonth, 'affected')))
  await pick(page, /This month/, 'Today')  // nothing started on 2 Oct: every part says so
  await expect(card(page, 'Open payment issues')).toHaveText('0')
  await expect(page.getByText(/No open payment issues started today/)).toBeVisible()
  await expect(page.getByText('No payment issues started in this range.')).toBeVisible()
})

test('H4 the chart has a Show toggle and a Group by toggle', async ({ page }) => {
  await page.goto('/?range=30d')
  const chart = page.getByTestId('issues-chart')
  await expect(chart.getByText('Paid, no access')).toBeVisible()  // grouped by cause, named in plain words
  await expect(chart.getByText('₹80k')).toBeVisible()  // the axis ticks carry the unit
  await pick(page, /Show: Value/, 'Volume')
  await expect(page.getByRole('button', { name: 'Show: Volume' })).toBeVisible()
  await expect(chart.getByText('₹80k')).toHaveCount(0)  // counts, not rupees
  await pick(page, /Group by: Cause/, 'Whose side')
  await expect(chart.getByText('Your code')).toBeVisible()
  await expect(chart.getByText('Paid, no access')).toHaveCount(0)
})

test('H5 the list is open issues by money at stake and each row opens its payment issue', async ({ page }) => {
  await page.goto('/?range=30d')
  const rows = page.getByTestId('home-issues').getByRole('link')
  const open = issues.filter((i) => i.status !== 'closed').sort((a, b) => b.at_risk_paise - a.at_risk_paise)
  await expect(rows).toHaveCount(open.length)
  await expect(rows.first()).toContainText(rupees(open[0].at_risk_paise))
  await rows.first().click()
  await expect(page).toHaveURL(new RegExp(`/incidents/${open[0].id}$`))
})

test('H7 the setup card lists the three steps, and folds into one line when setup is done', async ({ page }) => {
  await page.goto('/')
  const setup = page.getByTestId('setup-card')
  await expect(setup.getByText('0/3 COMPLETED')).toBeVisible()
  for (const step of ['Where customers write', 'Approvals', 'First check']) await expect(setup.getByText(step, { exact: true })).toBeVisible()
  await setup.getByRole('button', { name: 'Start setup' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await page.evaluate(() => localStorage.setItem('blindspot.setup', '3'))
  await page.goto('/')
  await expect(page.getByTestId('setup-card')).toHaveCount(0)
  await expect(page.getByText('Setup complete')).toBeVisible()
  await page.getByRole('button', { name: 'Review' }).click()
  await expect(page).toHaveURL(/\/setup$/)
})

test('H8 Reset setup asks once, then setup is back to 0 of 3 and the welcome tour opens', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('blindspot.setup', '2'))
  await page.goto('/')
  await expect(page.getByText('2/3 COMPLETED')).toBeVisible()
  await page.getByRole('button', { name: 'Reset setup' }).click()
  const confirm = page.getByRole('dialog', { name: 'Reset setup' })
  await confirm.getByRole('button', { name: 'Cancel' }).click()  // cancelling changes nothing
  await expect(confirm).toBeHidden()
  await expect(page.getByText('2/3 COMPLETED')).toBeVisible()
  await page.getByRole('button', { name: 'Reset setup' }).click()
  await confirm.getByRole('button', { name: 'Reset setup' }).click()
  await expect(page.getByRole('dialog', { name: 'Welcome to Blindspot' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Welcome to Blindspot' }).getByRole('button', { name: 'Look around first' }).click()
  await expect(page.getByText('0/3 COMPLETED')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('blindspot.setup'))).toBeNull()
})

test('H1 and H6 no tinted panel; the tour and reset links sit in the header; Ray answers from the bar and the chips', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Take a tour' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset setup' })).toBeVisible()
  await page.getByRole('button', { name: 'What is broken right now?' }).click()
  await expect(page.getByTestId('ray-thread')).toBeVisible()
})
