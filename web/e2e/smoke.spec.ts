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
  await expect(page.getByText(/^\d+ of \d+ scored checks pass$/)).toBeVisible()  // the score leads, every check is one tap away
  await page.getByRole('button', { name: /^Show all \d+ checks$/ }).click()
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

test('incident list adds up the incidents and says why a zone is empty; an incident page jumps to its fix', async ({ page }) => {
  await page.goto('/incidents')
  await expect(page.getByText('Customers affected', { exact: true })).toBeVisible()
  await expect(page.getByText(/Razorpay's own dashboard, so Blindspot does not look here/)).toBeVisible()
  await page.goto('/incidents/INC-1')
  await expect(page.getByRole('heading', { name: 'Fix it' })).not.toBeInViewport()
  await page.getByRole('button', { name: 'Start the fix' }).click()
  await expect(page.getByRole('heading', { name: 'Fix it' })).toBeInViewport()
})

// Guard's release check. A report with one safe button (run it again): it never changes anything, and it names the step that failed, what that means, and what to do.
test('S-20 release check: the starting world is on hold, each failed step says what to do, and it is reachable from the side nav', async ({ page }) => {
  await page.goto('/release-check')
  await expect(page.getByRole('heading', { name: 'Release check' })).toBeVisible()
  await expect(page.getByText('Hold the release', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1 of 5')).toBeVisible()  // only "your webhook answers" passes in the starting world
  await expect(page.getByText('Failed', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Not tried', { exact: true })).toHaveCount(2)
  await expect(page.getByText(/^Next: /)).toHaveCount(2)  // every failure ends in what to do
  await expect(page.getByText(/release-check.*safe_to_release/)).toBeVisible()  // the line for a release script
  await expect(page.getByText('What I cannot see')).toBeVisible()
  await expect(page.getByRole('button', { name: /grant|refund|send|approve|fix|revoke|undo/i })).toHaveCount(0)  // nothing here changes anything
  await expect(page.getByRole('button', { name: 'Run the check again' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Release check' }).first()).toBeVisible()
})

// Connect by prompt (PRD D21): a page of text. The prompt must carry the rules that close the failures the product finds, copy exactly, and point on to the release check.
test('S-21 connect by prompt: the prompt names the rules, copies exactly, and leads to the release check', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/connect')
  await expect(page.getByRole('heading', { name: 'Connect by prompt' })).toBeVisible()
  await expect(page.getByText('A proposal, shown as a prototype')).toBeVisible()
  const prompt = page.getByTestId('connect-prompt')
  await expect(prompt).toContainText('X-Razorpay-Signature')
  await expect(prompt).toContainText('X-Razorpay-Event-Id')
  await expect(prompt).toContainText('Grant the customer access in our own database FIRST')
  await expect(prompt).toContainText('fulfilment acknowledgement')
  await expect(prompt).toContainText('blindspot_test')
  await expect(prompt).not.toContainText(/rzp_(test|live)_|whsec_/)  // a prompt carries no key and no secret
  await page.getByRole('button', { name: 'Copy the prompt' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe((await prompt.innerText()).replace(/\u00a0/g, ' ').trim())
  await expect(page.getByText('What each rule closes')).toBeVisible()
  await expect(page.getByRole('button', { name: /grant|refund|send|approve|revoke|undo/i })).toHaveCount(0)  // it changes nothing
  await page.getByRole('button', { name: 'Open the release check' }).click()
  await expect(page).toHaveURL(/\/release-check$/)
  await expect(page.getByRole('link', { name: 'Connect by prompt' }).first()).toBeVisible()  // reachable from the side nav
})

// How we know: the numbers a viewer is told to look for are on the page, read from the report, and a reported figure does not look like a failure.
test('S-22 how we know shows the hero numbers, with the right limits and no false alarm on a reported figure', async ({ page }) => {
  await page.goto('/how')
  await expect(page.getByText(/of \d+ scored checks pass/)).toBeVisible()
  await expect(page.getByText('Silent customers for each one who complained (webhook incident)')).toBeVisible()
  await expect(page.getByText('kill line 2', { exact: true })).toBeVisible()  // the limit itself, not every digit in the target text glued together
  await expect(page.getByText(/^\d+ min$/).first()).toBeVisible()
  await expect(page.getByText('Minutes from the pay page breaking to the alert (pay page incident)')).toBeVisible()
  await expect(page.getByText(/Hero A|Hero B/)).toHaveCount(0)  // internal names stay out of the page
  await expect(page.getByText('What it asks of a founder, and what it costs')).toBeVisible()
})
