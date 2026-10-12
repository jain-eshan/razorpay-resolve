import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Two demo accounts on one dashboard (v3): Kaksha, a small business, and Flipkart, a big brand. The brand account's pages read the files `synth/brand_world.py` writes, so each
// test reads the same files and compares what the screen says with them. Nothing here checks a screen against a number typed in this file.
type Group = { id: string; label: string; count: number; amount_paise: number }
type Issue = { id: string; status: string; headline: string; affected: number; fixed: number; at_risk_paise: number; onset_at: string; groups: Group[]; money_stuck_paise: number; customers: { amount_paise: number; group: string }[]; actions: { id: string; button: string; done?: boolean }[] }
const list: { id: string; status: string; affected: number; fixed: number; at_risk_paise: number; onset_at: string; headline: string }[] = JSON.parse(readFileSync('public/brand/incidents.json', 'utf8'))
const fk = (id: string): Issue => JSON.parse(readFileSync(`public/brand/incidents/${id}.json`, 'utf8'))
const fk1 = fk('FK-1'), fk2 = fk('FK-2')
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
const n = (x: number) => x.toLocaleString('en-IN')
const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name })
const [twice, noOrder] = fk1.groups
const BRAND = '?account=flipkart'

test('the brand data adds up: the groups make the customers hit, and the money is the sum of the payments', () => {
  for (const id of ['FK-1', 'FK-2', 'FK-3']) {
    const d = fk(id)
    expect(d.groups.reduce((s, g) => s + g.count, 0), id).toBe(d.affected)
    expect(d.customers, id).toHaveLength(d.affected)
    for (const g of d.groups) expect(d.customers.filter((c) => c.group === g.id).reduce((s, c) => s + c.amount_paise, 0), `${id} ${g.id}`).toBe(g.amount_paise)
  }
  expect(fk1.money_stuck_paise).toBe(twice.amount_paise + noOrder.amount_paise)
  expect(list.map((i) => i.id)).toEqual(['FK-1', 'FK-2', 'FK-3'])
})

test('the way in: the account picker, then the brand account, then a switch back from the avatar', async ({ page }) => {
  await page.goto('/?signin')  // automated browsers skip the picker unless asked
  await expect(page).toHaveURL(/\/signin$/)
  await expect(page.getByRole('heading', { name: 'Choose a demo account' })).toBeVisible()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)  // not a login: nothing to type
  await page.getByTestId('account-flipkart').click()
  await btn(page, 'Continue as Flipkart').click()
  await expect(page.getByText(/Demo account\. Flipkart's customers/)).toBeVisible()
  await expect(page.getByTestId('home-issues')).toContainText(fk1.headline)
  await page.getByTestId('account-avatar').click()
  await page.getByRole('menuitem', { name: /Switch to Kaksha/ }).click()
  await expect(page.getByText(/Demo account\. Kaksha, its customers/)).toBeVisible()
})

test('each account has its own menu: the brand has no customer complaints or renewals', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/incidents')  // not Overview: its Explore cards carry the same names
  const nav = page  // the side menu (at this width there is no phone drawer to confuse it with)
  await expect(nav.getByRole('link', { name: 'Customer complaints' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Unpaid renewals' })).toBeVisible()
  await page.goto(`/incidents${BRAND}`)
  await expect(nav.getByRole('link', { name: 'Payment issues' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Customer complaints' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Unpaid renewals' })).toHaveCount(0)
})

test('a page or an issue of the other account says whose it is and offers the switch, instead of showing the other merchant', async ({ page }) => {
  await page.goto(`/threads${BRAND}`)
  await expect(page.getByText("This page is part of Kaksha's account")).toBeVisible()
  await page.goto(`/incidents/INC-1${BRAND}`)
  await expect(page.getByText("This page is part of Kaksha's account")).toBeVisible()
  await btn(page, 'Switch to Kaksha').click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('customers')
  await page.goto('/incidents/FK-1?account=kaksha')
  await expect(page.getByText("This page is part of Flipkart's account")).toBeVisible()
})

test('the brand Overview adds up its own issues', async ({ page }) => {
  await page.goto(`/${BRAND}&range=30d`)
  const open = list.filter((i) => i.status !== 'closed')
  const card = (label: string) => page.getByTestId('home-cards').getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]')
  await expect(card('Open payment issues')).toHaveText(String(open.length))
  await expect(card('Customers hit')).toHaveText(n(list.reduce((s, i) => s + i.affected, 0)))
  await expect(card('Money stuck')).toHaveText(rupees(open.reduce((s, i) => s + i.at_risk_paise, 0)))
  await expect(card('Customers made whole')).toHaveText(n(list.reduce((s, i) => s + i.fixed, 0)))
  await expect(page.getByText('Answers reach your team in Slack')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Ask Ray' })).toHaveCount(0)
})

test('FK-1: the story, the numbers and where it showed up, all from the file', async ({ page }) => {
  await page.goto(`/incidents/FK-1${BRAND}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fk1.headline)
  const stats = page.getByTestId('brand-stats')
  await expect(stats).toContainText(`${rupees(fk1.money_stuck_paise)} paid, no order confirmed`)
  await expect(stats).toContainText(n(twice.count))
  await expect(stats).toContainText(n(noOrder.count))
  await expect(page.getByTestId('preview-app')).toContainText('Payment failed')
  await expect(page.getByTestId('preview-alert')).toContainText('Sent to Razorpay')
  await expect(page.getByTestId('slack-rca')).toContainText(`${n(fk1.affected)} customers saw “failed” after paying. ${twice.count} paid twice. ${noOrder.count} left with no order.`)
  await expect(page.getByTestId('lane-axis')).toContainText('7:30 pm')
})

test('FK-1: the approvals go in order, show in the Slack preview, and the last one closes the issue', async ({ page }) => {
  await page.goto(`/incidents/FK-1${BRAND}`)
  const [refund, orders, message] = fk1.actions
  await expect(btn(page, message.button)).toBeDisabled()  // "your order is confirmed" cannot go before the orders are
  await btn(page, refund.button).click()
  await expect(page.getByTestId('story-4')).toContainText(`${n(twice.count)} of ${n(fk1.affected)} put right`)
  await expect(page.getByTestId('slack-rca')).toContainText('approved by you')
  await btn(page, orders.button).click()
  await btn(page, message.button).click()
  await expect(page.getByTestId('story-4')).toContainText(`All ${n(fk1.affected)} put right`)
  await expect(page.getByTestId('story-5')).toContainText(`${n(noOrder.count)} told`)
  await expect(page.getByText(/In this demo nothing was refunded or sent/)).toBeVisible()
  await page.reload()  // kept for this tab
  await expect(page.getByTestId('story-4')).toContainText(`All ${n(fk1.affected)} put right`)
  await btn(page, 'Start again').click()
  await expect(page.getByTestId('story-4')).toContainText(`0 of ${n(fk1.affected)} put right`)
})

test('FK-2: a closed issue on Razorpay\'s side says so, and shows what was done', async ({ page }) => {
  await page.goto(`/incidents/FK-2${BRAND}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fk2.headline)
  await expect(page.getByText('Closed: every customer is put right')).toBeVisible()
  await expect(page.getByText('What was done')).toBeVisible()
  await expect(page.getByTestId('root-cause-actions').getByText('Razorpay', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/No refund is made/)).toHaveCount(0)  // nothing waits for approval on a closed issue
})

test('the first big-brand demo links land on the brand account\'s open issue', async ({ page }) => {
  await page.goto('/demo/slack')
  await expect(page).toHaveURL(/\/incidents\/FK-1$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fk1.headline)
})

test('every figure follows the file: a changed FK-1 changes the page', async ({ page }) => {
  const changed = JSON.parse(JSON.stringify(fk1))
  changed.headline = '16 customers were told “Payment failed” after paying'
  changed.affected = 16
  changed.groups = [{ ...twice, count: 7, amount_paise: 11_111_100, hint: `${rupees(11_111_100)} to refund` }, { ...noOrder, count: 9, amount_paise: 22_222_200, hint: `${rupees(22_222_200)} paid` }]
  changed.money_stuck_paise = 33_333_300
  changed.customers = changed.customers.slice(0, 16)
  await page.route('**/brand/incidents/FK-1.json', (route) => route.fulfill({ json: changed }))
  await page.goto(`/incidents/FK-1${BRAND}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(changed.headline)
  await expect(page.getByTestId('brand-stats')).toContainText(`${rupees(33_333_300)} paid, no order confirmed`)
  await expect(page.getByTestId('story-2')).toContainText('16 customers hit')
})

// A card never changes size because of its data (web/DESIGN.md section 23 B): measured after every approval, at four widths.
const size = (page: Page, id: string) => page.getByTestId(id).evaluate((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` })
for (const width of [375, 768, 1024, 1440]) {
  test(`stability: FK-1's cards keep one size as the approvals go through, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/incidents/FK-1${BRAND}`)
    await page.getByTestId('story-strip').waitFor()
    const ids = ['story-strip', 'brand-stats', 'root-cause-actions']
    const seen: Record<string, string[]> = Object.fromEntries(ids.map((i) => [i, []]))
    const look = async () => { for (const id of ids) seen[id].push(await size(page, id)) }
    await look()
    for (const a of fk1.actions) {
      await btn(page, a.button).click()
      await expect(page.getByTestId(`action-${a.id}`)).toContainText('Approved by you')
      await look()
    }
    for (const [id, sizes] of Object.entries(seen)) expect(new Set(sizes), `${id} changed size: ${sizes.join(' → ')}`).toHaveProperty('size', 1)
  })
}
