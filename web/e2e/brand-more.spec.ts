import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The brand account's four other open issues (FK-4 to FK-7, `synth/brand_extra.py`): HDFC Bank debits not confirmed, two orders for one payment, a blank card pay screen on iOS (before
// payment) and coupon orders charged the full price. Like brand.spec.ts, every figure on screen is compared with the file the generator writes, never with a number typed here.
type Action = { id: string; title: string; button: string; needs?: string; group?: string; told?: number }
type Issue = {
  id: string; headline: string; owner: string; confidence: string; zone: 'before' | 'after'; inferred: boolean; affected: number; money_stuck_paise: number
  groups: { id: string; label: string; count: number; amount_paise: number; hint: string; put_right: boolean }[]
  actions: Action[]; customers: { payment_id: string; group: string }[]; closing: string
}
const read = (f: string) => JSON.parse(readFileSync(`public/brand/${f}`, 'utf8'))
const ids = ['FK-4', 'FK-5', 'FK-6', 'FK-7']
const issues: Issue[] = ids.map((id) => read(`incidents/${id}.json`))
const list: { id: string; zone: string; inferred: boolean; headline: string; status: string }[] = read('incidents.json')
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
const n = (x: number) => x.toLocaleString('en-IN')
const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name })
const size = (page: Page, id: string) => page.getByTestId(id).evaluate((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` })
const BRAND = '?account=flipkart'

test('the data adds up, and each issue has a message that waits for a step before it', () => {
  for (const d of issues) {
    expect(d.groups.reduce((s, g) => s + g.count, 0), d.id).toBe(d.affected)
    expect(d.customers, d.id).toHaveLength(d.affected)
    expect(d.groups.reduce((s, g) => s + g.amount_paise, 0), d.id).toBe(d.money_stuck_paise)
    const message = d.actions.at(-1)!
    expect(message.id, d.id).toBe('message')
    expect(message.needs, `${d.id}: the message to customers waits for something`).toBeTruthy()
  }
})

for (const d of issues) {
  test(`${d.id}: the page carries the file's headline, owner, confidence and figures`, async ({ page }) => {
    await page.goto(`/incidents/${d.id}${BRAND}`)
    await expect(page.getByRole('heading', { level: 1, name: d.headline })).toBeVisible()
    const stats = page.getByTestId('brand-stats')
    await expect(stats).toContainText(n(d.affected))
    for (const g of d.groups) { await expect(stats).toContainText(n(g.count)); await expect(stats).toContainText(g.hint) }
    await expect(page.getByTestId('page')).toContainText((d.confidence === 'exact' ? 'Highest confidence' : `${d.confidence[0].toUpperCase()}${d.confidence.slice(1)} confidence`))
    if (d.inferred) await expect(stats).toContainText(`About ${n(d.affected)}`)  // a count worked out from carts says so
    else await expect(stats).not.toContainText('About')
    await expect(page.getByTestId('where-it-showed-up')).toBeVisible()  // the Slack thread
  })

  test(`${d.id}: the approvals go in order, and the last one closes the issue`, async ({ page }) => {
    await page.goto(`/incidents/${d.id}${BRAND}`)
    const start = d.groups.filter((g) => g.put_right).reduce((x, g) => x + g.count, 0)  // groups that are already put right (the ones who paid another way)
    await expect(page.getByTestId('story-4')).toContainText(`${n(start)} of ${n(d.affected)} put right`)
    for (const a of d.actions) {
      if (a.needs) await expect(btn(page, a.button), `${a.id} waits for ${a.needs}`).toBeDisabled()
    }
    for (const a of d.actions) {
      await expect(btn(page, a.button)).toBeEnabled()
      await btn(page, a.button).click()
      await expect(page.getByTestId(`action-${a.id}`)).toContainText('Approved by you')
    }
    await expect(page.getByTestId('story-4')).toContainText(`All ${n(d.affected)} put right`)
    await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible()
  })
}

test('the list: the four sit under the right heading, and the one before payment is marked as an estimate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto(`/incidents${BRAND}`)
  const y = async (text: string) => (await page.getByText(text).first().boundingBox())!.y
  const after = await y('After payment')
  for (const i of list.filter((x) => ids.includes(x.id))) {
    const at = await y(i.headline)
    expect(i.zone === 'before' ? at < after : at > after, `${i.id} is under ${i.zone} payment`).toBe(true)
  }
  await expect(page.getByText('Your code · estimated').first()).toBeVisible()
  await expect(page.getByText('The bank').first()).toBeVisible()
})

test('each new issue appears in the Overview, the alerts it came from, and the audit trail', async ({ page }) => {
  await page.goto(`/${BRAND}`)
  const home = page.getByTestId('home-issues')
  await expect(home).toBeVisible()
  const alerts: { issue: string | null; why: string }[] = read('alerts.json')
  for (const iid of ['FK-5', 'FK-6']) expect(alerts.some((a) => a.issue === iid), `an alert matched to ${iid}`).toBe(true)
  await page.goto(`/alerts${BRAND}`)
  for (const a of alerts.filter((x) => x.issue && ['FK-5', 'FK-6'].includes(x.issue))) await expect(page.getByText(a.why, { exact: true }).first()).toBeVisible()
  const audit: { events: { ref: string | null; kind: string; summary: string }[] } = read('audit.json')
  for (const iid of ids) expect(audit.events.some((e) => e.ref === iid && e.kind === 'sign_off'), `${iid} was signed off`).toBe(true)
})

for (const width of [375, 768, 1024, 1440]) {
  test(`stability: the new issue pages keep one size for their cards as the approvals go through, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const d of issues) {
      await page.goto(`/incidents/${d.id}${BRAND}`)
      await page.evaluate(() => sessionStorage.removeItem('blindspot.brand.approved'))
      await page.reload()
      await page.getByTestId('story-strip').waitFor()
      const tids = ['story-strip', 'brand-stats', 'root-cause-actions']
      const seen: Record<string, string[]> = Object.fromEntries(tids.map((x) => [x, []]))
      const look = async () => { for (const t of tids) seen[t].push(await size(page, t)) }
      await look()
      for (const a of d.actions) { await btn(page, a.button).click(); await expect(page.getByTestId(`action-${a.id}`)).toContainText('Approved by you'); await look() }
      for (const [t, sizes] of Object.entries(seen)) expect(new Set(sizes), `${d.id} ${t} changed size: ${sizes.join(' → ')}`).toHaveProperty('size', 1)
    }
  })
}
