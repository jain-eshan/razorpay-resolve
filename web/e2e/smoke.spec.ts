import { expect, test } from '@playwright/test'

// Smoke tests for the R1 screens. They read the snapshot written by `make snapshot` (real pipeline output), so they assert shapes, not exact counts.

test('S-01 Ray alert says how many customers were affected', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ray on WhatsApp' })).toBeVisible()
  await expect(page.getByText(/\d+ customer affected so far/)).toBeVisible()
  await expect(page.getByText(/^\d+ customers paid, no access$/)).toBeVisible()  // the full count sits beside the clip; the clip is only the first heads-up
  await expect(page.getByRole('group', { name: /^WhatsApp chat with Ray by Razorpay/ }).first()).toBeVisible()  // Ray's alerts are drawn as WhatsApp, not as cards
})

test('S-02 payment issues are grouped by stage and one opens', async ({ page }) => {
  await page.goto('/incidents')
  await expect(page.getByText('After payment', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /paid and did not get access/ }).first().click()
  await expect(page).toHaveURL(/\/incidents\/INC-1$/)
})

test('S-03 incident page: numbers add up, tiers switch, replay limits shown', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  await expect(page.getByRole('heading', { name: /customers paid and did not get access/ })).toBeVisible()
  await expect(page.getByText('Your code', { exact: true }).first()).toBeVisible()
  const n = async (label: string) => Number((await page.getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]').innerText()).replace(/\D/g, ''))
  const wrote = Number((await page.getByTestId('story-1').getByText(/^\d+ wrote in$/).innerText()).replace(/\D/g, ''))
  expect(wrote + (await n('Never wrote in'))).toBe(await n('Customers hit'))  // the three numbers at the top add up
  await expect(page.getByText(/^\d+ found · \d+ still without access · left out: /)).toBeVisible()  // the counts add up in one line
  await expect(page.getByText('Can Razorpay replay these?')).toBeVisible()
  await expect(page.getByText(/by a support ticket, one event at a time/)).toBeVisible()
  await page.getByText(/^Left out \(/).click()
  await expect(page.getByText(/refunded|already active/).first()).toBeVisible()
})

test('S-17 the first check plays its checklist, then states what it found', async ({ page }) => {
  await page.goto('/scan')
  await expect(page.getByTestId('scan-running')).toBeVisible()  // every visit plays the scan
  await expect(page.getByText(/I found \d+ customers in the last 30 days who paid and have no access/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /customers paid and have no access/ })).toBeVisible()
  await page.getByRole('button', { name: 'Run it again' }).click()
  await expect(page.getByTestId('scan-running')).toBeVisible()  // it can be run again
  await expect(page.getByText(/I found \d+ customers/)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^Start the fix/ }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-\d+$/)
  await page.goto('/scan')
  await expect(page.getByTestId('scan-running')).toBeVisible()  // and a later visit plays it again too
})

test('S-10 accuracy shows every gate passing', async ({ page }) => {
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
  await expect(page.getByText('Demo: every connector is simulated')).toBeVisible()
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
test('S-19 unpaid renewals: the stat is the list, the inside-rule customers are apart, and there is nothing to press', async ({ page }) => {
  await page.goto('/access')
  await expect(page.getByRole('heading', { name: 'Unpaid renewals' })).toBeVisible()
  await expect(page.getByText('Resolve never takes access away')).toBeVisible()
  await expect(page.getByText(/^\d+ customers? past your grace period$/)).toBeVisible()
  const stat = Number((await page.getByText('Kept access', { exact: true }).locator('xpath=following-sibling::*[1]').innerText()).replace(/\D/g, ''))
  expect(stat).toBeGreaterThan(0)
  await expect(page.getByRole('row')).toHaveCount(stat + 4)  // one row per customer in the list, plus the four inside the rule
  await expect(page.getByText(/\d+ more are still inside their grace period/)).toBeVisible()
  await expect(page.getByText('Left out, and why')).toBeVisible()
  await expect(page.getByText('What Resolve cannot see')).toBeVisible()
  await expect(page.getByRole('button', { name: /revoke|remove|cut|send|approve|refund|grant|fix|message|extend/i })).toHaveCount(0)  // nothing here changes anything (the page has no main landmark to scope to, so the check is by name)
  await expect(page.getByRole('link', { name: 'Unpaid renewals' }).first()).toBeVisible()  // reachable from the side nav
})

test('payment issues add up and say why a stage is left out; an issue page jumps to its fix', async ({ page }) => {
  await page.goto('/incidents')
  await expect(page.getByText('Customers affected', { exact: true })).toBeVisible()
  await expect(page.getByText(/Success Rate page already covers payments that fail at the bank or the UPI app, so Resolve leaves them out/)).toBeVisible()
  await page.goto('/incidents/INC-1')
  await expect(page.getByRole('heading', { name: 'Fix it' })).not.toBeInViewport()
  await page.getByTestId('root-cause-actions').getByRole('button', { name: 'Start the fix' }).click()  // the page's one blue button, in the Actions card
  await expect(page.getByRole('heading', { name: 'Fix it' })).toBeInViewport()
})

// Guard's release check. A report with one safe button (run it again): it never changes anything, and it names the step that failed, what that means, and what to do.
test('S-20 go-live check: the starting world is on hold, each failed step says what to do, and it is reachable from the side nav', async ({ page }) => {
  await page.goto('/release-check')
  await expect(page.getByRole('heading', { name: 'Integration' })).toBeVisible()
  await expect(page.getByText('2. Go-live check')).toBeVisible()
  await expect(page.getByText('Hold the release', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1 of 5')).toBeVisible()  // only "your webhook answers" passes in the starting world
  await expect(page.getByText('Failed', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Not tried', { exact: true })).toHaveCount(2)
  await expect(page.getByText(/^Next: /)).toHaveCount(2)  // every failure ends in what to do
  await expect(page.getByText(/release-check.*safe_to_release/)).toBeVisible()  // the line for a release script
  await expect(page.getByText('What I cannot see')).toBeVisible()
  await expect(page.getByRole('button', { name: /grant|refund|send|approve|fix|revoke|undo/i })).toHaveCount(0)  // nothing here changes anything
  await expect(page.getByRole('button', { name: 'Run the check again' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Integration' }).first()).toBeVisible()
})

// Connect by prompt (PRD D21): a page of text. The prompt must carry the rules that close the failures the product finds, copy exactly, and point on to the release check.
test('S-21 build with AI: the prompt names the rules, copies exactly, and leads to the go-live check', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/connect')
  await expect(page.getByRole('heading', { name: 'Integration' })).toBeVisible()
  await expect(page.getByText('Prototype', { exact: true })).toBeVisible()
  const prompt = page.getByTestId('connect-prompt')
  await expect(prompt).toContainText('X-Razorpay-Signature')
  await expect(prompt).toContainText('X-Razorpay-Event-Id')
  await expect(prompt).toContainText('Grant the customer access in our own database FIRST')
  await expect(prompt).toContainText('fulfilment acknowledgement')
  await expect(prompt).toContainText('resolve_test')
  await expect(prompt).not.toContainText(/rzp_(test|live)_|whsec_/)  // a prompt carries no key and no secret
  await page.getByRole('button', { name: 'Copy the prompt' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe((await prompt.innerText()).replace(/\u00a0/g, ' ').trim())
  await expect(page.getByText('What each rule closes')).toBeVisible()
  await expect(page.getByRole('button', { name: /grant|refund|send|approve|revoke|undo/i })).toHaveCount(0)  // it changes nothing
  await page.getByRole('button', { name: 'Open the go-live check' }).click()
  await expect(page).toHaveURL(/\/release-check$/)
  await expect(page.getByRole('link', { name: 'Integration' }).first()).toBeVisible()  // reachable from the side nav
})

// How we know: the numbers a viewer is told to look for are on the page, read from the report, and a reported figure does not look like a failure.
test('S-22 accuracy shows the hero numbers, with the right limits and no false alarm on a reported figure', async ({ page }) => {
  await page.goto('/how')
  await expect(page.getByText(/of \d+ scored checks pass/)).toBeVisible()
  await expect(page.getByText('Customers who never wrote in, for each one who did (webhook issue)')).toBeVisible()
  await expect(page.getByText('we stop if it falls under 2', { exact: true })).toBeVisible()  // the limit itself, not every digit in the target text glued together
  await expect(page.getByText(/^\d+ min$/).first()).toBeVisible()
  await expect(page.getByText('Minutes from the pay page breaking to the alert (pay page issue)')).toBeVisible()
  await expect(page.getByText(/Hero A|Hero B/)).toHaveCount(0)  // internal names stay out of the page
  await expect(page.getByText('What it asks of you, and what it costs')).toBeVisible()
})
