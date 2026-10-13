import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The brand account's own pages (v3 batch 1.5, T4): Alerts, Integration, Connectors, Settings and Audit trail. Each test reads the files `synth/brand_world.py` writes and
// compares the screen with them, so a figure typed into a page, or a page that stops reading its file, fails here.
const read = (f: string) => JSON.parse(readFileSync(`public/brand/${f}`, 'utf8'))
type Alert = { id: string; tool: string; title: string; status: 'matched' | 'dropped' | 'no_impact'; issue: string | null; why: string }
type Section = { id: string; title: string; rows: { label: string; value?: string; code?: string; list?: string[]; note?: string }[] }
const alerts: Alert[] = read('alerts.json')
const integration: { set_up: string; sections: Section[] } = read('integration.json')
const settings: { set_up: string; sections: Section[] } = read('settings.json')
const connectors: { groups: { items: { id: string; name: string; status: string; sends: string; count: string; off: string }[] }[] } = read('connectors.json')
const audit: { kinds: Record<string, string>; events: { kind: string; summary: string }[]; pending: { action: string; summary: string }[]; pending_actor: string } = read('audit.json')
const fk1: { actions: { id: string; button: string }[] } = read('incidents/FK-1.json')
const incidents: { id: string; headline: string }[] = read('incidents.json')
const BRAND = '?account=flipkart'
const stat = (page: Page, label: string) => page.getByTestId('alert-stats').getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]')

test('each account has its own menu: the brand gets Alerts and its own Integration, Connectors, Settings and Audit trail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/incidents${BRAND}`)
  for (const name of ['Alerts', 'Integration', 'Connectors', 'Settings', 'Audit trail']) await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Alert tuning' })).toHaveCount(0)
  await page.goto('/incidents?account=kaksha')
  await expect(page.getByRole('link', { name: 'Alerts', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Alert tuning' })).toBeVisible()
  // Kaksha opening the brand's Alerts by its address is told whose page it is
  await page.goto('/alerts?account=kaksha')
  await expect(page.getByText("This page is part of Flipkart's account")).toBeVisible()
})

test('Alerts: the stat cards add up the rows, and every matched alert links to its payment issue', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/alerts${BRAND}`)
  const count = (s: Alert['status']) => String(alerts.filter((a) => a.status === s).length)
  await expect(stat(page, 'Alerts received')).toHaveText(String(alerts.length))
  await expect(stat(page, 'Matched to payments')).toHaveText(count('matched'))
  await expect(stat(page, 'Left out by your filter')).toHaveText(count('dropped'))
  await expect(stat(page, 'Checked, no impact')).toHaveText(count('no_impact'))
  const list = page.getByTestId('alert-list')
  await expect(list.getByRole('row')).toHaveCount(alerts.length)  // one row per alert (Blade's header row is not a `row`)
  for (const a of alerts) await expect(list.getByText(a.why, { exact: true }).first()).toBeVisible()
  const matched = alerts.filter((a) => a.issue)
  expect(matched.length).toBeGreaterThan(0)
  await expect(list.getByRole('link')).toHaveCount(matched.length)
  const first = matched[0]
  await list.getByRole('link', { name: incidents.find((i) => i.id === first.issue)!.headline }).first().click()
  await expect(page).toHaveURL(new RegExp(`/incidents/${first.issue}$`))
})

test('Alerts on a phone: one card per alert, nothing as a table', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto(`/alerts${BRAND}`)
  await expect(page.getByTestId('alert-card')).toHaveCount(alerts.length)
  await expect(page.getByTestId('alert-list').getByRole('row').first()).toBeHidden()
})

test('Alerts: a changed file changes the page', async ({ page }) => {
  await page.route('**/brand/alerts.json', (route) => route.fulfill({ json: alerts.slice(0, 2) }))
  await page.goto(`/alerts${BRAND}`)
  await expect(stat(page, 'Alerts received')).toHaveText('2')
  await page.unroute('**/brand/alerts.json')
  await page.route('**/brand/alerts.json', (route) => route.fulfill({ json: [] }))
  await page.reload()
  await expect(page.getByText('No alerts yet')).toBeVisible()
})

test('Integration and Settings show every setting from their files, read only, with nothing that looks like a secret', async ({ page }) => {
  for (const [path, data] of [['/connect', integration], ['/settings', settings]] as const) {
    await page.goto(`${path}${BRAND}`)
    await expect(page.getByText(data.set_up)).toBeVisible()
    for (const s of data.sections) {
      const panel = page.getByTestId(`section-${s.id}`)
      await expect(panel.getByRole('heading', { name: s.title })).toBeVisible()
      for (const r of s.rows) {
        await expect(panel.getByText(r.label, { exact: true })).toBeVisible()
        for (const t of [r.value, r.code, r.note, ...(r.list ?? [])].filter(Boolean) as string[]) await expect(panel.getByText(t, { exact: true }).first()).toBeVisible()
      }
    }
    await expect(page.getByTestId('page').locator('input, textarea')).toHaveCount(0)  // the shell's own search and switch are not the page's
    await expect(page.getByRole('button', { name: /Save/ })).toHaveCount(0)
    expect(await page.getByTestId('page').innerText()).not.toMatch(/rzp_(live|test)_|whsec_|[A-Za-z0-9]{32,}/)
  }
  await expect(page.getByTestId('brand-settings')).toBeVisible()
  await page.goto(`/connect${BRAND}`)
  await expect(page.getByText('The signing secret is shown once, when you create it.', { exact: false })).toBeVisible()
})

test('the same address shows the page of the account you are in, and a switch swaps it', async ({ page }) => {
  await page.goto('/settings?account=kaksha')
  await expect(page.getByTestId('settings')).toBeVisible()
  await page.getByTestId('account-avatar').click()
  await page.getByRole('menuitem', { name: /Switch to Flipkart/ }).click()
  await page.goto('/settings')  // the switch lands on Overview; the same address now opens the brand's page
  await expect(page.getByTestId('brand-settings')).toBeVisible()
})

test('Connectors: every connector from the file, and Disconnect then Undo in this tab', async ({ page }) => {
  await page.goto(`/channels${BRAND}`)
  const all = connectors.groups.flatMap((g) => g.items)
  const live = all.filter((c) => c.status !== 'later')
  for (const c of all) {
    await expect(page.getByTestId(`connector-${c.id}`)).toContainText(c.name)
    await expect(page.getByTestId(`connector-${c.id}`)).toContainText(c.sends)
  }
  await expect(page.getByText(`${live.length} of ${live.length} on`)).toBeVisible()
  const sentry = all.find((c) => c.id === 'sentry')!
  await expect(page.getByTestId('connector-sentry')).toContainText(sentry.count)
  await page.getByRole('button', { name: 'Disconnect Sentry' }).click()
  await expect(page.getByText(sentry.off)).toBeVisible()
  await expect(page.getByText(`${live.length - 1} of ${live.length} on`)).toBeVisible()
  await page.getByRole('button', { name: 'Undo, connect it again' }).click()
  await expect(page.getByText(sentry.off)).toHaveCount(0)
  await expect(page.getByTestId('connector-freshdesk').getByRole('button')).toHaveCount(0)  // coming later: nothing to switch
})

test('Audit trail: every event from the file, the kind filter, and approvals made in this tab on top', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/audit${BRAND}`)
  const audit_ = page.getByTestId('brand-audit')
  await expect(audit_.getByText(`${audit.events.length} entries`)).toBeVisible()
  await expect(audit_.getByRole('row').first()).toContainText(audit.events[0].summary)  // newest first
  await page.getByRole('button', { name: 'Kind: All' }).click()
  await page.getByRole('menuitem', { name: audit.kinds.sign_off }).click()
  const signOffs = audit.events.filter((e) => e.kind === 'sign_off').length
  expect(signOffs).toBeGreaterThan(0)
  await expect(audit_.getByText(`${signOffs} entries`)).toBeVisible()
  await expect(audit_.getByRole('row')).toHaveCount(signOffs)
  // approve the first FK-1 action on its page, then the trail has it at the top
  await page.goto(`/incidents/FK-1${BRAND}`)
  await page.getByRole('button', { name: fk1.actions[0].button }).click()
  await page.goto(`/audit${BRAND}`)
  await expect(audit_.getByText(`${audit.events.length + 1} entries`)).toBeVisible()
  const top = audit_.getByRole('row').first()
  await expect(top).toContainText(audit.pending.find((p) => p.action === fk1.actions[0].id)!.summary)
  await expect(top).toContainText(audit.pending_actor)
  await expect(top).toContainText('In this tab')
})

test('the brand Overview lists the brand pages in Explore', async ({ page }) => {
  await page.goto(`/${BRAND}`)
  // Each card's own line (the side menu has the same links, so a link alone proves nothing)
  for (const [to, line] of [['/alerts', 'What your alert tools sent'], ['/connect', 'Your alert door and shared Slack'], ['/channels', 'Alert tools, Slack'], ['/settings', 'What waits for approval'], ['/audit', 'Every alert, root cause and approval']]) {
    await expect(page.locator(`a[href="${to}"]`).filter({ hasText: line })).toBeVisible()
  }
  await expect(page.getByText('Choose where customers can reach you')).toHaveCount(0)  // not Kaksha's lines
})
