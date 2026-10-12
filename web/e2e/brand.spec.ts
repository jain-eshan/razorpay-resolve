import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The big-brand demo (v3 batch 1.3, journey J2): store, alert, Slack thread, issue page. Every number on these screens comes from `public/brand/j2.json`, which `synth/j2_brand.py` writes,
// so each test reads that file and compares what the screen says with it. Nothing on the screens is checked against a number typed here.
type J2 = {
  app_version: string
  counts: { affected: number; paid_twice: number; no_order: number; sentry_events: number }
  money_paise: { stuck: number; paid_twice: number; no_order: number }
  customers: { amount_paise: number; outcome: string }[]
}
const j2: J2 = JSON.parse(readFileSync('public/brand/j2.json', 'utf8'))
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
const n = (x: number) => x.toLocaleString('en-IN')
const { counts: c, money_paise: m } = j2
const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name })

test('the data adds up: the 1,240 split into 410 and 830, and the money is the sum of the payments', () => {
  expect(c.affected).toBe(c.paid_twice + c.no_order)
  expect(j2.customers).toHaveLength(c.affected)
  const sum = (o?: string) => j2.customers.filter((x) => !o || x.outcome === o).reduce((a, x) => a + x.amount_paise, 0)
  expect([sum(), sum('paid_twice'), sum('no_order')]).toEqual([m.stuck, m.paid_twice, m.no_order])
})

test('store: without app 8.2 a payment shows as paid', async ({ page }) => {
  await page.goto('/demo/store')
  await btn(page, /^Pay ₹/).click()
  await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible()
  await expect(page.getByTestId('behind-the-screen').getByText('Verified the payment')).toBeVisible()
})

test('store: with app 8.2 shipped, a captured payment shows as failed, and paying again is a second charge', async ({ page }) => {
  await page.goto('/demo/store')
  await page.getByRole('switch', { name: `Ship app ${j2.app_version}` }).dispatchEvent('click')  // Blade keeps the real checkbox off screen
  await btn(page, /^Pay ₹/).click()
  await expect(page.getByRole('heading', { name: 'Payment failed' })).toBeVisible()
  const behind = page.getByTestId('behind-the-screen')
  await expect(behind.getByText('Payment captured')).toBeVisible()  // Razorpay has the money
  await expect(behind.getByText('Never asked to verify')).toBeVisible()
  await expect(behind.getByText(/This is how \d+ customers paid twice/)).toHaveCount(0)  // the count of customers who paid twice comes only after the customer tries again
  await btn(page, 'Try again').click()
  await btn(page, /^Pay ₹/).click()
  await expect(behind.getByText('Captured 2 payments')).toBeVisible()
  await expect(behind.getByText(`Paying again is a second charge. This is how ${c.paid_twice} customers paid twice.`)).toBeVisible()
})

test('the alert page says what Sentry saw, and that it was forwarded to Razorpay', async ({ page }) => {
  await page.goto('/demo/alert')
  await expect(page.getByTestId('alert-header')).toContainText('Forwarded to Razorpay')
  await expect(page.getByText(`${c.sentry_events}`, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Demo data.')).toBeVisible()
})

test('the Slack thread carries the numbers from the data, and an approval there shows on the issue page', async ({ page }) => {
  await page.goto('/demo/slack')
  const rca = page.getByTestId('slack-rca')
  await expect(rca).toContainText(`${n(c.affected)} customers saw “failed” after paying. ${c.paid_twice} paid twice. ${c.no_order} left with no order.`)
  // The amount and the count are on screen before the button is pressed.
  await expect(rca).toContainText(`${rupees(m.paid_twice)} back to the original payment methods`)
  await expect(btn(page, `Message ${c.no_order} customers`)).toBeDisabled()  // not until the orders are confirmed
  await expect(rca).toContainText('No refund is made and no message is sent')  // an approval here must never read as a real refund
  await btn(page, `Refund ${c.paid_twice} duplicates`).click()
  await expect(page.getByTestId('slack-step-refund')).toContainText('Approved by you')
  await btn(page, 'Open evidence').click()
  await expect(page).toHaveURL(/\/demo\/incident$/)
  await expect(page.getByTestId('story-4')).toContainText(`${n(c.paid_twice)} of ${n(c.affected)} put right`)
  await expect(page.getByTestId('action-refund')).toContainText('Approved by you')
})

test('the issue page: story, three numbers, evidence and the actions, all from the data', async ({ page }) => {
  await page.goto('/demo/incident')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`${n(c.affected)} customers paid by UPI`)
  const stats = page.getByTestId('brand-stats')
  await expect(stats).toContainText(n(c.affected))
  await expect(stats).toContainText(`${rupees(m.stuck)} paid, no order confirmed`)
  await expect(stats).toContainText(`${rupees(m.paid_twice)} to refund`)
  await expect(stats).toContainText(`${rupees(m.no_order)} paid`)
  await expect(page.getByTestId('lane-axis')).toContainText('7:30 pm')
  await expect(page.getByTestId('just-you')).toContainText('All affected payments came from app 8.2, against 0% normally.')
  // The side menu keeps Payment issues marked, because this page is one.
  await expect(page.getByRole('link', { name: 'Payment issues' }).first()).toHaveAttribute('aria-current', 'page')
})

test('the three approvals go in order, and the last one closes the issue', async ({ page }) => {
  await page.goto('/demo/incident')
  // The message to customers cannot go before the orders are confirmed: telling them "your order is confirmed" would be false.
  await expect(btn(page, `Message ${c.no_order} customers`)).toBeDisabled()
  await btn(page, `Refund ${c.paid_twice} duplicates`).click()
  await btn(page, `Send ${c.no_order} order list`).click()
  await expect(btn(page, `Message ${c.no_order} customers`)).toBeEnabled()
  await expect(page.getByTestId('story-4')).toContainText(`${n(c.paid_twice)} of ${n(c.affected)} put right`)
  await btn(page, `Message ${c.no_order} customers`).click()
  await expect(page.getByTestId('story-4')).toContainText(`All ${n(c.affected)} put right`)
  await expect(page.getByTestId('story-5')).toContainText(`${n(c.no_order)} told`)
  await expect(page.getByText('Closed: every customer is put right')).toBeVisible()
  // The closing message says plainly that nothing was really refunded or sent (the footnote under the actions says it from the start, so it is not the proof).
  await expect(page.getByText(/In this demo nothing was refunded or sent/)).toBeVisible()
  await expect(page.getByText(/account review pack/)).toHaveCount(0)  // that is in the PRD, not built: the page must not claim it

})

test('the customers table lists who paid twice, then who got no order', async ({ page }) => {
  await page.goto('/demo/incident')
  await expect(btn(page, `Paid twice (${c.paid_twice})`).or(page.getByRole('radio', { name: `Paid twice (${c.paid_twice})` }))).toBeVisible()
  await expect(page.getByText('Paid again, and that one got an order').first()).toBeVisible()
  await page.getByRole('radio', { name: `No order (${c.no_order})` }).click({ force: true })
  await expect(page.getByText('Paid, and no order was made').first()).toBeVisible()
})

test('the demo path: Next goes store, alert, Slack, issue page, then Overview; Start again clears the approvals', async ({ page }) => {
  await page.goto('/demo/store')
  for (const [next, url] of [['Next: Alert', /\/demo\/alert$/], ['Next: Slack', /\/demo\/slack$/], ['Next: Issue page', /\/demo\/incident$/]] as const) {
    await btn(page, next).click()
    await expect(page).toHaveURL(url)
  }
  await btn(page, `Refund ${c.paid_twice} duplicates`).click()
  await expect(page.getByTestId('action-refund')).toContainText('Approved by you')
  await btn(page, 'Start again').click()
  await expect(page).toHaveURL(/\/demo\/store$/)
  await btn(page, 'Next: Alert').click()
  await btn(page, 'Next: Slack').click()
  await expect(btn(page, `Refund ${c.paid_twice} duplicates`)).toBeVisible()  // the approval is gone
  await btn(page, 'Next: Issue page').click()
  await btn(page, 'Finish').click()
  await expect(page).toHaveURL(/\/$/)
})

// A card never changes size because of its data (web/DESIGN.md section 23 B). Measured, not looked at: each card's size is read after every state, and all must be the same.
const size = (page: Page, id: string) => page.getByTestId(id).evaluate((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` })

for (const width of [375, 768, 1024, 1440]) {
  test(`stability: the store's two cards keep one size through every state, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/demo/store')
    const seen: Record<string, string[]> = { 'store-screen': [], 'behind-the-screen': [] }
    const look = async () => { for (const id of Object.keys(seen)) seen[id].push(await size(page, id)) }
    await look()
    await page.getByRole('switch', { name: `Ship app ${j2.app_version}` }).dispatchEvent('click')
    await look()
    await btn(page, /^Pay ₹/).click()
    await look()  // while paying
    await expect(page.getByRole('heading', { name: 'Payment failed' })).toBeVisible()
    await look()
    await btn(page, 'Try again').click()
    await look()
    await btn(page, /^Pay ₹/).click()
    await expect(page.getByRole('heading', { name: 'Payment failed' })).toBeVisible()
    await look()  // second failure: the note about a second charge is showing
    await page.getByRole('switch', { name: `Ship app ${j2.app_version}` }).dispatchEvent('click')
    await btn(page, 'Try again').click()
    await btn(page, /^Pay ₹/).click()
    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible()
    await look()
    for (const [id, sizes] of Object.entries(seen)) expect(new Set(sizes), `${id} changed size: ${sizes.join(' → ')}`).toHaveProperty('size', 1)
  })

  test(`stability: the issue page's cards keep one size as the approvals go through, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/demo/incident')
    await page.getByTestId('story-strip').waitFor()
    const ids = ['story-strip', 'brand-stats', 'root-cause-actions']
    const seen: Record<string, string[]> = Object.fromEntries(ids.map((i) => [i, []]))
    const look = async () => { for (const id of ids) seen[id].push(await size(page, id)) }
    await look()
    for (const name of [`Refund ${c.paid_twice} duplicates`, `Send ${c.no_order} order list`, `Message ${c.no_order} customers`]) {
      await btn(page, name).click()
      await expect(page.getByText('Approved by you').first()).toBeVisible()
      await look()
    }
    await expect(page.getByText('Closed: every customer is put right')).toBeVisible()
    await look()
    for (const [id, sizes] of Object.entries(seen)) expect(new Set(sizes), `${id} changed size: ${sizes.join(' → ')}`).toHaveProperty('size', 1)
  })
}

test('edge: if the demo data cannot load, each page says what to do, and keeps its path bar', async ({ page }) => {
  await page.route('**/brand/j2.json', (route) => route.fulfill({ status: 500, body: 'no' }))
  for (const url of ['/demo/store', '/demo/alert', '/demo/slack']) {
    await page.goto(url)
    await expect(page.getByText('The demo data did not load')).toBeVisible()
    await expect(page.getByText('synth.j2_brand')).toBeVisible()
    await expect(page.getByTestId('demo-path')).toBeVisible()
  }
  await page.goto('/demo/incident')
  await expect(page.getByText('The demo data did not load')).toBeVisible()
  await expect(page.getByTestId('demo-path')).toBeVisible()
})

test('edge: the approvals survive a reload of the page, and a browser that refuses storage still works while the tab is open', async ({ page }) => {
  await page.goto('/demo/incident')
  await btn(page, `Refund ${c.paid_twice} duplicates`).click()
  await page.reload()
  await expect(page.getByTestId('story-4')).toContainText(`${n(c.paid_twice)} of ${n(c.affected)} put right`)
  await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('storage refused') } }) })
  await page.goto('/demo/slack')
  await btn(page, `Refund ${c.paid_twice} duplicates`).click()
  await expect(page.getByTestId('slack-step-refund')).toContainText('Approved by you')
})

test('way in: the Payment issues page offers the big-brand example, and it starts at the store', async ({ page }) => {
  await page.goto('/incidents')
  await btn(page, 'Try a big-brand example').click()
  await expect(page).toHaveURL(/\/demo\/store$/)
})

test('stability: the Slack channel keeps one size as the three steps are approved, at 375, 768, 1024 and 1440px', async ({ page }) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/demo/slack')
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()
    await page.getByTestId('slack-rca').waitFor()
    const ids = ['slack-channel', 'slack-rca']
    const seen: Record<string, string[]> = Object.fromEntries(ids.map((i) => [i, []]))
    const look = async () => { for (const id of ids) seen[id].push(await size(page, id)) }
    await look()
    for (const name of [`Refund ${c.paid_twice} duplicates`, `Send ${c.no_order} order list`, `Message ${c.no_order} customers`]) {
      await btn(page, name).click()
      await expect(page.getByTestId(`slack-step-${name.startsWith('Refund') ? 'refund' : name.startsWith('Send') ? 'orders' : 'message'}`)).toContainText('Approved by you')
      await look()
    }
    for (const [id, sizes] of Object.entries(seen)) expect(new Set(sizes), `${id} at ${width}px changed size: ${sizes.join(' → ')}`).toHaveProperty('size', 1)
    // The proof of an approval must be readable, not cut short: no text in the card is cut by its box, sideways or by a clamped line (the heights above cannot see a clipped line: Blade clamps a badge to one line, so the row stays 36px).
    const clipped = await page.getByTestId('slack-rca').evaluate((el) => [...el.querySelectorAll('*')].filter((n) => (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1) && getComputedStyle(n).overflow !== 'visible').map((n) => n.textContent))
    expect(clipped, `text cut short at ${width}px`).toEqual([])
  }
})

test('every figure follows the data: a changed j2.json changes every screen, and nothing typed is left showing', async ({ page }) => {
  const changed = JSON.parse(JSON.stringify(j2)) as Record<string, any>  // eslint-disable-line
  changed.counts = { ...changed.counts, affected: 16, paid_twice: 7, no_order: 9, sentry_events: 12 }
  changed.money_paise = { stuck: 123_456_700, paid_twice: 11_111_100, no_order: 22_222_200 }
  changed.sentry = { ...changed.sentry, events: 12, window_minutes: 7 }
  changed.app_version = '9.9'
  changed.previous_version = '9.8'
  changed.platform = 'iOS'
  changed.baseline_minutes = 45
  changed.customers = changed.customers.slice(0, 16).map((x: { outcome: string }, i: number) => ({ ...x, outcome: i < 7 ? 'paid_twice' : 'no_order', second_at: '2026-10-02T19:50:00+05:30' }))
  await page.route('**/brand/j2.json', (route) => route.fulfill({ json: changed }))
  await page.goto('/demo/slack')
  const rca = page.getByTestId('slack-rca')
  await expect(rca).toContainText('RCA: iOS app 9.9 shows')
  await expect(rca).toContainText('16 customers saw “failed” after paying. 7 paid twice. 9 left with no order.')
  await expect(rca).toContainText(rupees(11_111_100))
  await expect(page.getByTestId('slack-channel')).toContainText('12 events in 7 minutes')
  await expect(page.getByTestId('slack-channel')).not.toContainText('410')
  await page.goto('/demo/incident')
  await expect(page.getByTestId('brand-stats')).toContainText(`${rupees(123_456_700)} paid, no order confirmed`)
  await expect(page.getByTestId('just-you')).toContainText('45 minutes before the release')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('16 customers paid by UPI')
  await page.goto('/demo/alert')
  await expect(page.getByTestId('alert-header')).toContainText('ios@9.9')
  await page.goto('/demo/store')
  await expect(page.getByTestId('behind-the-screen')).toContainText('iOS 9.8')  // the version before the release comes from the data too
})

test('way out: every demo screen but the last offers to leave, to the Payment issues page', async ({ page }) => {
  for (const url of ['/demo/store', '/demo/alert', '/demo/slack']) {
    await page.goto(url)
    await btn(page, 'Leave the demo').click()
    await expect(page).toHaveURL(/\/incidents$/)
  }
  await page.goto('/demo/incident')
  await expect(btn(page, 'Leave the demo')).toHaveCount(0)  // the last screen has Finish
})

test('the blue button: one at most on each screen, and Next is blue only when nothing else is the next thing to do', async ({ page }) => {
  // Blade's primary blue is about rgb(19, 100, 241): count the visible buttons whose fill is that blue (the same test as e2e/incident.spec.ts).
  const blue = async (u: string) => {
    await page.goto(u)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('demo-path').getByRole('button', { name: /^(Next|Finish)/ }).waitFor()
    await page.waitForTimeout(500)  // Blade fades a button's fill in
    const buttons = await page.getByTestId('page').locator('button').evaluateAll((els) => els.filter((b) => b.getBoundingClientRect().width > 0).map((b) => ({ name: b.textContent, bg: getComputedStyle(b).backgroundColor })))
    expect(buttons.length, `${u}: the check found the page's buttons`).toBeGreaterThanOrEqual(3)  // a check that finds nothing passes: say it found them
    return buttons.filter((b) => { const m = b.bg.match(/\d+/g)?.map(Number) ?? []; return m.length >= 3 && m[2] > 200 && m[0] < 80 && m[1] < 140 }).map((b) => b.name)
  }
  expect(await blue('/demo/alert')).toEqual(['Next: Slack'])
  expect(await blue('/demo/slack')).toEqual([])  // the three decisions are the screen's own; Next goes blue once they are made
  expect(await blue('/demo/incident')).toEqual([`Refund ${c.paid_twice} duplicates`])
  for (const name of [`Refund ${c.paid_twice} duplicates`, `Send ${c.no_order} order list`, `Message ${c.no_order} customers`]) await btn(page, name).click()
  expect(await blue('/demo/incident')).toEqual(['Finish'])
  expect(await blue('/demo/slack')).toEqual(['Next: Issue page'])
})
