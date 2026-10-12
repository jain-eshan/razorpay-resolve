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
  await page.getByRole('button', { name: trigger }).first().click()  // the page's own menu comes first; the chart has one too
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
  await expect(page.getByRole('button', { name: 'Last 7 days' }).first()).toBeVisible()  // the default
  await pick(page, /Last 7 days/, 'This month')
  await expect(page).toHaveURL(/range=month/)
  await expect(card(page, 'Customers hit')).toHaveText(String(sum(thisMonth, 'affected')))
  await expect(page.getByTestId('home-issues').getByRole('link')).toHaveCount(thisMonth.length)
  await expect(page.getByTestId('issues-chart').getByText('1 Oct', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'This month' }).first()).toBeVisible()
  await expect(card(page, 'Customers hit')).toHaveText(String(sum(thisMonth, 'affected')))
  await pick(page, /This month/, 'Today')  // nothing started on 2 Oct: every part says so
  await expect(card(page, 'Open payment issues')).toHaveText('0')
  await expect(page.getByText(/No open payment issues started today/)).toBeVisible()
  await expect(page.getByTestId('issues-chart').getByText('no payment issues started today')).toBeVisible()
})

test('H4 the chart has its own time horizon, a Show toggle and a Group by toggle, and says what it adds up to', async ({ page }) => {
  await page.goto('/?range=30d')
  const chart = page.getByTestId('issues-chart')
  await expect(chart.getByRole('heading', { name: rupees(sum(issues, 'at_risk_paise')) })).toBeVisible()  // the card reads without hovering
  await expect(chart.getByText(`across ${issues.length} payment issues that started last 30 days`)).toBeVisible()
  await expect(chart.getByText('Paid, no access')).toBeVisible()  // grouped by cause, named in plain words
  await expect(chart.getByText('₹80k')).toBeVisible()  // the axis ticks carry the unit
  await pick(page, /Show: Value/, 'Volume')
  await expect(chart.getByRole('heading', { name: `${sum(issues, 'affected')} customers` })).toBeVisible()
  await expect(chart.getByText('₹80k')).toHaveCount(0)  // counts, not rupees
  await pick(page, /Group by: Cause/, 'Whose side')
  await expect(chart.getByText('Your code')).toBeVisible()
  await expect(chart.getByText('Paid, no access')).toHaveCount(0)
  // The chart's horizon moves on its own: the page's cards keep the page's range.
  await chart.getByRole('button', { name: 'Last 30 days' }).click()
  await page.getByRole('menuitem', { name: 'This month' }).click()
  await expect(chart.getByText(`across ${thisMonth.length} payment issue that started this month`)).toBeVisible()
  await expect(card(page, 'Customers hit')).toHaveText(String(sum(issues, 'affected')))
})

test('H4 the legend stays inside its card and below the axis labels, at phone, tablet, laptop and desktop width', async ({ page }) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?range=30d')
    const chart = page.getByTestId('issues-chart')
    await expect(chart.getByText('Paid, no access').first()).toBeVisible()
    await page.waitForTimeout(1200)  // the bars finish drawing
    const m = await chart.evaluate((el) => {
      const bottom = (n: Element) => n.getBoundingClientRect().bottom
      const labels = [...el.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value')]
      const items = [...el.querySelectorAll('.recharts-legend-wrapper button')]
      const card = el.closest('[data-blade-component="card"]')!
      return { lowestLabel: Math.max(...labels.map(bottom)), legendTop: el.querySelector('.recharts-legend-wrapper')!.getBoundingClientRect().top, lowestItem: Math.max(...items.map(bottom)), cardBottom: bottom(card), items: items.length }
    })
    expect(m.items, `every group is in the legend at ${width}px`).toBe(4)
    expect(m.legendTop, `legend starts below the axis labels at ${width}px`).toBeGreaterThanOrEqual(m.lowestLabel)
    expect(m.lowestItem, `the last legend item is inside the card at ${width}px`).toBeLessThanOrEqual(m.cardBottom)
  }
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

test('H1 and H6 no tinted panel; the tour and reset links sit in the header; a question opens Ray\'s chat page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Take a tour' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset setup' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Ask Ray' }).fill('What is broken right now?')
  await page.getByRole('textbox', { name: 'Ask Ray' }).press('Enter')
  await expect(page).toHaveURL(/\/ray\/\w+$/)
  await expect(page.getByTestId('ray-thread')).toBeVisible()
  await expect(page.getByText('What is broken right now?').first()).toBeVisible()  // the merchant's own bubble
})

test('Overview order: Ask Ray, then setup, then the four cards, then the issues, then the pages', async ({ page }) => {
  await page.goto('/')
  const top = async (loc: ReturnType<Page['getByTestId']>) => (await loc.boundingBox())!.y
  const order = [await top(page.getByRole('textbox', { name: 'Ask Ray' })), await top(page.getByTestId('setup-card')), await top(page.getByTestId('home-cards')), await top(page.getByTestId('home-issues')), await top(page.getByRole('heading', { name: 'Explore Blindspot' }))]
  expect(order, 'each block starts below the one before it').toEqual([...order].sort((a, b) => a - b))
})

test('Ray chat: a question is kept in the history, the history reopens it, and the way back and the side menu are there', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Ask Ray' }).fill('Who paid and did not get access?')
  await page.getByRole('textbox', { name: 'Ask Ray' }).press('Enter')
  await expect(page).toHaveURL(/\/ray\/\w+$/)
  await expect(page.getByRole('heading', { name: /customers paid and have no access/ })).toBeVisible({ timeout: 10_000 })
  // The side menu stays, with Overview marked as where you are; "Overview" at the top of the page goes back.
  await expect(page.getByRole('link', { name: 'Payment issues' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Overview' }).first()).toHaveAttribute('aria-current', 'page')
  await page.getByRole('textbox', { name: 'Ask Ray' }).fill('What is broken right now?')  // a second question joins the same chat
  await page.getByRole('textbox', { name: 'Ask Ray' }).press('Enter')
  await expect(page.getByText(/payment issues?, ₹[\d,]+ involved/)).toBeVisible({ timeout: 10_000 })
  const url = page.url()
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/ray$/)
  await expect(page.getByRole('heading', { name: 'How can I help you?' })).toBeVisible()
  await page.getByRole('button', { name: 'History' }).click()
  const drawer = page.getByRole('dialog', { name: 'Chat history' })
  await expect(drawer.getByText('Who paid and did not get access?')).toBeVisible()
  await expect(drawer.getByText(/2 questions/)).toBeVisible()
  await drawer.getByText('Who paid and did not get access?').click()
  await expect(page).toHaveURL(url)
  await expect(page.getByText('What is broken right now?').first()).toBeVisible()
  await page.getByRole('button', { name: 'Overview' }).click()  // the way back
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
})

test('Ray chat edge cases: a question Ray cannot answer, an address from another browser, and clearing the history', async ({ page }) => {
  await page.goto('/ray')
  await page.getByRole('textbox', { name: 'Ask Ray' }).fill('rrr')
  await page.getByRole('textbox', { name: 'Ask Ray' }).press('Enter')
  await expect(page.getByText('I can answer from your payment data')).toBeVisible()  // Ray says so, and offers what it can answer
  await page.getByText('Who paid and did not get access?').last().click()  // an offered question runs in the same chat
  await expect(page.getByRole('heading', { name: /customers paid and have no access/ })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('textbox', { name: 'Ask Ray' }).fill('   ')  // an empty question does nothing
  await page.getByRole('textbox', { name: 'Ask Ray' }).press('Enter')
  await expect(page.getByTestId('ray-thread').getByText('rrr')).toHaveCount(1)
  await page.goto('/ray/not-a-chat')
  await expect(page.getByText(/That chat is not saved in this browser/)).toBeVisible()
  await page.getByRole('textbox', { name: 'Ask Ray' }).fill('What is broken right now?')  // and asking from there starts a real chat
  await page.getByRole('textbox', { name: 'Ask Ray' }).press('Enter')
  await expect(page).toHaveURL(/\/ray\/(?!not-a-chat)\w+$/)
  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('dialog', { name: 'Chat history' }).getByRole('button', { name: 'Clear history' }).click()
  await expect(page.getByRole('dialog', { name: 'Chat history' }).getByText(/No chats yet/)).toBeVisible()
})

test('Ray chat: History on the Overview lists the chats, and an empty history says so', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByRole('dialog', { name: 'Chat history' }).getByText(/No chats yet/)).toBeVisible()
})

test('Ray chat page fits the screen at phone, tablet and desktop width', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/ray')
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'How can I help you?' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${width}px`).toBe(true)
  }
  expect(errors).toEqual([])
})

test('Setup tiles open the matching step, and a step not reached yet is not a link', async ({ page }) => {
  await page.goto('/')
  const setup = page.getByTestId('setup-card')
  await expect(setup.getByRole('link')).toHaveCount(1)  // only the next step
  await setup.getByRole('link', { name: /Where customers write/ }).click()
  await expect(page).toHaveURL(/\/setup\?step=0$/)
  await expect(page.getByText('Step 1 of 3: Where customers write')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('blindspot.setup', '2'))
  await page.goto('/')
  await expect(page.getByTestId('setup-card').getByRole('link')).toHaveCount(3)  // two done and the next
  await page.getByTestId('setup-card').getByRole('link', { name: /Approvals/ }).click()
  await expect(page.getByText('Step 2 of 3: Approvals')).toBeVisible()
})

test('Continue setup resumes at the next step, not step 1', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('blindspot.setup', '2'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue setup' }).click()
  await expect(page.getByText('Step 3 of 3: First check')).toBeVisible()
})

test('Ray chat: the toolbar stays in view while a long thread scrolls, and nothing is drawn over the toolbar or the input', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 })
  await page.goto('/ray')
  const ask = async (q: string, answers: RegExp, count: number) => {
    await page.getByRole('textbox', { name: 'Ask Ray' }).fill(q)
    await page.getByRole('textbox', { name: 'Ask Ray' }).press('Enter')
    await expect(page.getByRole('heading', { name: answers })).toHaveCount(count, { timeout: 10_000 })  // wait for the answer, not for the words of the question (the chips use them too)
  }
  await ask('What is broken right now?', /payment issues?, ₹[\d,]+ involved/, 1)
  await ask('Who paid and did not get access?', /customers paid and have no access/, 1)
  await ask('What is broken right now?', /payment issues?, ₹[\d,]+ involved/, 2)
  const scroller = page.getByTestId('scroller')
  // Scroll the thread in steps. At every step, whatever sits under the middle of a button in the thread that overlaps the toolbar or the dock must be that bar, not the button.
  const covered = new Set<string>()
  for (let top = 0; top < 4000; top += 150) {
    await scroller.evaluate((el, y) => { el.scrollTop = y }, top)
    const bad = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('[data-testid="ray-dock"]')].concat([...document.querySelectorAll('[data-testid="ray-thread"] > div')].filter((d) => getComputedStyle(d).position === 'sticky' && getComputedStyle(d).top === '0px'))
      const out: string[] = []
      for (const b of document.querySelectorAll('[data-testid="ray-thread"] button')) {
        if (bars.some((bar) => bar.contains(b))) continue
        const r = b.getBoundingClientRect()
        const x = r.left + r.width / 2, y = r.top + r.height / 2
        const bar = bars.find((q) => { const k = q.getBoundingClientRect(); return y > k.top && y < k.bottom && x > k.left && x < k.right })
        if (bar && !bar.contains(document.elementFromPoint(x, y))) out.push(b.textContent ?? '')
      }
      return out
    })
    bad.forEach((t) => covered.add(t))
  }
  expect([...covered], 'no thread button paints over the toolbar or the input').toEqual([])
  await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight })
  for (const name of ['Overview', 'History', 'New chat']) {
    const box = (await page.getByRole('button', { name, exact: true }).first().boundingBox())!
    expect(box.y, `${name} is on screen after scrolling to the end`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(700)
    expect(box.height, `${name} is at least 36px high`).toBeGreaterThanOrEqual(36)
  }
})
