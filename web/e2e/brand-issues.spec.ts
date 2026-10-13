import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The big-brand demo's other issues (the list on /demo/issues and one page each). Like brand.spec.ts, every number on screen is compared with the data file that `synth/brand_issues.py`
// writes (`public/brand/issues.json`), never with a number typed here.
type Issue = {
  id: string; short: string; headline: string; closing: string; zone: string; owner: string
  counts: { affected: number; complained: number }; money_paise: number
  groups: { id: string; label: string; note: string; count: number; money_paise: number }[]
  actions: { id: string; kind: 'fix' | 'tell'; button: string; covers: number }[]
  inferred: boolean
  customers: { id: string; amount_paise: number; group: string }[]
}
const file: { issues: Issue[] } = JSON.parse(readFileSync('public/brand/issues.json', 'utf8'))
const j2: { counts: { affected: number; paid_twice: number }; money_paise: { stuck: number } } = JSON.parse(readFileSync('public/brand/j2.json', 'utf8'))
const issues = file.issues
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
const n = (x: number) => x.toLocaleString('en-IN')
const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name })
const size = (page: Page, id: string) => page.getByTestId(id).evaluate((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` })
const fixes = (i: Issue) => i.actions.filter((a) => a.kind === 'fix')
const tell = (i: Issue) => i.actions.find((a) => a.kind === 'tell')!

test('the data adds up: each issue splits into its two groups, and the money is the sum of the customers', () => {
  expect(issues.map((i) => i.id)).toEqual(['bank-pending', 'dup-orders', 'ios-checkout', 'coupon-mismatch'])
  for (const i of issues) {
    expect(i.customers, i.id).toHaveLength(i.counts.affected)
    expect(i.groups.reduce((a, g) => a + g.count, 0), i.id).toBe(i.counts.affected)
    expect(i.customers.reduce((a, x) => a + x.amount_paise, 0), i.id).toBe(i.money_paise)
  }
})

test('the list: the app 8.2 story and the four others, with the numbers from the data, and each row opens its page', async ({ page }) => {
  await page.goto('/demo/issues')
  await expect(page.getByRole('heading', { name: 'Payment issues' })).toBeVisible()
  const total = j2.money_paise.stuck + issues.reduce((a, i) => a + i.money_paise, 0)
  const people = j2.counts.affected + issues.reduce((a, i) => a + i.counts.affected, 0)
  const main = page.getByTestId('page')
  await expect(main).toContainText(/Open issues\s*5\s*of 5 found/)
  await expect(main).toContainText(rupees(total))
  await expect(main).toContainText(n(people))
  await expect(page.getByRole('link', { name: `${n(j2.counts.affected)} customers paid by UPI and saw “Payment failed”` })).toBeVisible()
  for (const i of issues) {
    await expect(page.getByRole('link', { name: i.headline })).toBeVisible()
    await expect(main).toContainText(rupees(i.money_paise))
  }
  await page.getByRole('link', { name: issues[1].headline }).click()
  await expect(page).toHaveURL(new RegExp(`/demo/issues/${issues[1].id}$`))
  await expect(page.getByRole('heading', { level: 1, name: issues[1].headline })).toBeVisible()
})

test('the list puts the one issue before payment under Before payment, and the others after', async ({ page }) => {
  await page.goto('/demo/issues')
  const before = issues.filter((i) => i.zone === 'before').length
  await expect(page.getByText(`${before} found`, { exact: true })).toBeVisible()
  await expect(page.getByText(`${issues.length + 1 - before} found`, { exact: true })).toBeVisible()
  const y = async (text: string | RegExp) => (await page.getByText(text).first().boundingBox())!.y
  const afterHeading = await y('After payment')
  for (const i of issues) {
    const at = await y(i.headline)
    expect(i.zone === 'before' ? at < afterHeading : at > afterHeading, `${i.id} is under the right heading`).toBe(true)
  }
})

for (const i of issues) {
  test(`issue page ${i.id}: the numbers come from the data, and approving the fixes unlocks the message and closes it`, async ({ page }) => {
    await page.goto(`/demo/issues/${i.id}`)
    await expect(page.getByRole('heading', { level: 1, name: i.headline })).toBeVisible()
    await expect(page.getByTestId('page')).not.toContainText('{brand}')  // the brand's name is filled in from lib/brand.ts
    if (i.inferred) await expect(page.getByTestId('brand-stats')).toContainText('About')  // a count worked out from carts is called an estimate in every number
    const stats = page.getByTestId('brand-stats')
    await expect(stats).toContainText(n(i.counts.affected))
    await expect(stats).toContainText(rupees(i.money_paise))
    for (const g of i.groups) { await expect(stats).toContainText(`${n(g.count)}`); await expect(stats).toContainText(rupees(g.money_paise)) }
    await expect(page.getByTestId('story-4')).toContainText(`0 of ${n(i.counts.affected)} covered`)
    const message = btn(page, tell(i).button)
    await expect(message).toBeDisabled()  // not before the brand has what it needs to do first
    for (const a of fixes(i)) { await expect(message).toBeDisabled(); await btn(page, a.button).click() }
    await expect(message).toBeEnabled()
    await expect(page.getByTestId('story-4')).toContainText(`${n(i.counts.affected)} of ${n(i.counts.affected)} covered`)
    await message.click()
    await expect(page.getByText('All actions approved')).toBeVisible()
    await expect(page.getByText(i.closing)).toBeVisible()
    await expect(page.getByTestId('story-5')).toContainText(`${n(tell(i).covers)} to be told`)
    await expect(page.getByTestId('page')).not.toContainText('put right')  // approving a list sent to a bank fixes nothing, so the page never says it does
    await expect(page.getByTestId('page')).not.toContainText('Closed')
  })

  test(`issue page ${i.id}: each group's tab lists its own customers and not the other group's`, async ({ page }) => {
    await page.goto(`/demo/issues/${i.id}`)
    for (const g of i.groups) {
      await page.getByRole('radio', { name: new RegExp(`^${g.label} \\(${n(g.count)}\\)`) }).click({ force: true })
      const first = i.customers.find((x) => x.group === g.id)!
      await expect(page.getByText(first.id).first(), `${g.label}: its first customer is listed`).toBeVisible()
      const other = i.customers.slice(5).find((x) => x.group !== g.id)!  // not one of the five "sample payment IDs" the Root cause panel shows from either group
      await expect(page.getByText(other.id), `${g.label}: a customer of the other group is not`).toHaveCount(0)
    }
  })
}

test('an issue whose actions are all approved reads Approved on the list, and "Start again" on the story opens them all', async ({ page }) => {
  const i = issues[0]
  await page.goto(`/demo/issues/${i.id}`)
  for (const a of i.actions) await btn(page, a.button).click()
  await btn(page, 'Back to all issues').click()
  await expect(page).toHaveURL(/\/demo\/issues$/)
  await expect(page.getByTestId('page')).toContainText(/Open issues\s*4\s*of 5 found/)
  await expect(page.getByText('Approved', { exact: true }).filter({ visible: true })).toHaveCount(1)  // the table and the phone cards are both in the page, one is hidden  // the table and the phone cards are both in the page, one is hidden
  await page.goto('/demo/store')
  await btn(page, 'Start again').click()
  await page.goto('/demo/issues')
  await expect(page.getByTestId('page')).toContainText(/Open issues\s*5\s*of 5 found/)
})

test('the journey: the story ends at the list, and the list leads back to the story', async ({ page }) => {
  await page.goto('/demo/incident')
  await btn(page, 'See all issues').click()
  await expect(page).toHaveURL(/\/demo\/issues$/)
  await page.goto('/demo/incident')
  await btn(page, `Refund ${j2.counts.paid_twice} duplicates`).click()  // an approval made on the story
  await btn(page, 'See all issues').click()
  await btn(page, 'Replay the app 8.2 story').click()
  await expect(page).toHaveURL(/\/demo\/store$/)
  await page.goto('/demo/incident')
  await expect(btn(page, `Refund ${j2.counts.paid_twice} duplicates`)).toBeVisible()  // the replay starts again: that approval is gone
  await page.goto('/demo/issues')
  await btn(page, 'Leave the demo').click()
  await expect(page).toHaveURL(/\/incidents$/)
  await page.goto('/demo/issues')
  await page.getByRole('link', { name: `${n(j2.counts.affected)} customers paid by UPI and saw “Payment failed”` }).click()
  await expect(page).toHaveURL(/\/demo\/incident$/)
  await page.getByTestId('page').getByRole('link', { name: 'Payment issues' }).click()  // the breadcrumb (inside the page, not the side menu) goes to the brand's list, not Kaksha's
  await expect(page).toHaveURL(/\/demo\/issues$/)
})

test('the menu: on the brand\'s pages Payment issues opens the brand\'s list and the account is the brand, and on Kaksha\'s pages it does not', async ({ page }) => {
  for (const url of ['/demo/issues', '/demo/incident', `/demo/issues/${issues[0].id}`]) {
    await page.goto(url)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Payment issues' }).first(), url).toHaveAttribute('href', '/demo/issues')
    await expect(page.getByText('FL', { exact: true }), url).toBeVisible()
  }
  await page.goto('/incidents')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Payment issues' }).first()).toHaveAttribute('href', '/incidents')
  await expect(page.getByText('FL', { exact: true })).toHaveCount(0)
})

test('edge: the page follows a changed data file, and an unknown issue and a failed load say what to do', async ({ page }) => {
  await page.route('**/brand/issues.json', (route) => {
    const d = JSON.parse(JSON.stringify(file))
    d.issues[0].headline = 'A headline that only this test has'
    d.issues[0].counts.affected = 999
    d.issues[0].money_paise = 123456700
    return route.fulfill({ json: d })
  })
  await page.goto('/demo/issues')
  await expect(page.getByRole('link', { name: 'A headline that only this test has' })).toBeVisible()
  await expect(page.getByTestId('page')).toContainText('₹12,34,567')
  await page.goto(`/demo/issues/${issues[0].id}`)
  await expect(page.getByTestId('brand-stats')).toContainText('999')
  await page.goto('/demo/issues/not-an-issue')
  await expect(page.getByText('This issue is not in the demo')).toBeVisible()
  await page.unroute('**/brand/issues.json')
  await page.route('**/brand/issues.json', (route) => route.fulfill({ status: 500, body: 'no' }))
  for (const url of ['/demo/issues', `/demo/issues/${issues[0].id}`]) {
    await page.goto(url)
    await expect(page.getByText('The demo data did not load')).toBeVisible()
    await expect(page.getByText(/synth\.brand_issues/)).toBeVisible()
  }
})

// A card never changes size because of its data (web/DESIGN.md section 23 B): each card's size is read after every approval, and all must be the same.
for (const width of [375, 768, 1024, 1440]) {
  test(`stability: every issue page keeps one size for its cards as the approvals go through, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const i of issues) {
      await page.goto(`/demo/issues/${i.id}`)
      await page.evaluate(() => sessionStorage.clear())
      await page.reload()
      await page.getByTestId('story-strip').waitFor()
      const ids = ['story-strip', 'brand-stats', 'issue-banner', 'root-cause-actions']
      const seen: Record<string, string[]> = Object.fromEntries(ids.map((x) => [x, []]))
      const look = async () => { for (const id of ids) seen[id].push(await size(page, id)) }
      await look()
      for (const a of i.actions) {
        await btn(page, a.button).click()
        await expect(page.getByText('Approved by you').first()).toBeVisible()
        await look()
      }
      await expect(page.getByText('All actions approved')).toBeVisible()
      await look()
      for (const [id, sizes] of Object.entries(seen)) expect(new Set(sizes), `${i.id} ${id} changed size: ${sizes.join(' → ')}`).toHaveProperty('size', 1)
    }
  })
}

test('the text is not cut off by its box on any issue page, at four widths', async ({ page }) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const i of issues) {
      await page.goto(`/demo/issues/${i.id}`)
      await page.evaluate(() => sessionStorage.clear())
      await page.reload()
      await page.getByTestId('story-strip').waitFor()
      for (const a of i.actions) await btn(page, a.button).click()
      const cut = await page.getByTestId('page').evaluate((el) => [...el.querySelectorAll('*')].filter((x) => {
        const s = getComputedStyle(x)
        const clips = ['hidden', 'clip'].includes(s.overflowX) || ['hidden', 'clip'].includes(s.overflowY)
        return clips && !x.closest('[data-blade-component="table"], table') && x.getBoundingClientRect().width > 0 && (x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1)
      }).map((x) => (x.textContent ?? '').slice(0, 60)))
      expect(cut, `${i.id} at ${width}px`).toEqual([])
    }
  }
})
