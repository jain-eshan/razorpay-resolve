import { expect, test } from '@playwright/test'

// Smoke tests for the R1 screens. They read the snapshot written by `make snapshot` (real pipeline output), so they assert shapes, not exact counts.

test('S-01 Ray alert says how many customers were affected', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ray on WhatsApp' })).toBeVisible()
  await expect(page.getByText(/\d+ customer affected so far/)).toBeVisible()
  await expect(page.getByText(/^\d+ customers · ₹[\d,]+ at risk$/)).toBeVisible()  // the full count sits beside the clip; the clip is only the first heads-up
  await expect(page.getByRole('group', { name: /^WhatsApp chat with Ray by Razorpay/ }).first()).toBeVisible()  // Ray's alerts are drawn as WhatsApp, not as cards
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

test('S-17 day-0 scan plays its checklist, then states what it found', async ({ page }) => {
  await page.goto('/scan')
  await expect(page.getByTestId('scan-running')).toBeVisible()  // every visit plays the scan
  await expect(page.getByText(/I found \d+ customers in the last 30 days who paid and have no access/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /customers paid and have no access/ })).toBeVisible()
  await page.getByRole('button', { name: 'Run it again' }).click()
  await expect(page.getByTestId('scan-running')).toBeVisible()  // it can be run again
  await expect(page.getByText(/I found \d+ customers/)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^Fix it with Ray/ }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-\d+$/)
  await page.goto('/scan')
  await expect(page.getByTestId('scan-running')).toBeVisible()  // and a later visit plays it again too
})

test('S-10 how we know shows every gate passing', async ({ page }) => {
  await page.goto('/how')
  await expect(page.getByText('silent to complained ratio')).toBeVisible()
  await expect(page.getByText('fail', { exact: true })).toHaveCount(0)
  await expect(page.getByText('pass', { exact: true }).first()).toBeVisible()
})

test('S-12 channels shows consent and who the agent speaks as, read-only in the snapshot', async ({ page }) => {
  await page.goto('/channels')
  await expect(page.getByText('WhatsApp payments number')).toBeVisible()
  await expect(page.getByText('Speaks as: Kaksha payment help, powered by Razorpay').first()).toBeVisible()
  await expect(page.getByText('Read-only snapshot')).toBeVisible()
  await page.getByRole('button', { name: 'Disconnect' }).first().click() // control is visible in the demo, and so is undo
  await expect(page.getByText('Disconnected. Ray has stopped reading and replying here.')).toBeVisible()
  await page.getByRole('button', { name: 'Undo, connect it again' }).click()
  await expect(page.getByText('Disconnected. Ray has stopped')).toHaveCount(0)
})

test('S-04 a case opens from the snapshot without a server', async ({ page, request }) => {
  const cases = await (await request.get('/snapshot/cases.json')).json()
  expect(cases.length).toBeGreaterThan(10)
  await page.goto(`/cases/${cases[0].id}`)
  await expect(page.getByText(/Matched to pay_\w+ by an exact identifier/)).toBeVisible()
  await expect(page.getByText('Customer says')).toBeVisible()
})

// J6. A report, not an action: it lists customers whose UPI renewal failed and who still have access past the merchant's rule, and offers nothing that changes anything.
test('S-19 access report: the stat is the list, the inside-rule customers are apart, and there is nothing to press', async ({ page }) => {
  await page.goto('/access')
  await expect(page.getByRole('heading', { name: 'Access without payment' })).toBeVisible()
  await expect(page.getByText('A report, not an action')).toBeVisible()
  await expect(page.getByText(/\d+ customers failed a UPI renewal, are past your 48 hour rule and still have access/)).toBeVisible()
  const stat = Number((await page.getByText('Customers past your rule', { exact: true }).locator('xpath=following-sibling::*[1]').innerText()).replace(/\D/g, ''))
  expect(stat).toBeGreaterThan(0)
  await expect(page.getByRole('row')).toHaveCount(stat + 4)  // one row per customer in the list, plus the four inside the rule
  await expect(page.getByText(/\d+ more are inside your rule/)).toBeVisible()
  await expect(page.getByText('Left out, and why')).toBeVisible()
  await expect(page.getByText('What I cannot see')).toBeVisible()
  await expect(page.getByRole('button', { name: /revoke|remove|cut|send|approve|refund|grant|fix|message|extend/i })).toHaveCount(0)  // nothing here changes anything (the page has no main landmark to scope to, so the check is by name)
  await expect(page.getByRole('link', { name: 'Access report' }).first()).toBeVisible()  // reachable from the side nav
})
