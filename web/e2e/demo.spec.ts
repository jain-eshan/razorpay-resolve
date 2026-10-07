import { expect, test, type Page } from '@playwright/test'

// The guided demo: the hosted site has no server, so these run against the static snapshot and the frames recorded from the real engine.
// A full page load starts the demo over, so the tests move around with in-app links.

const panel = (page: Page) => page.getByTestId('fix-panel')
const btn = (page: Page, name: string | RegExp) => panel(page).getByRole('button', { name })

test('Hero A plays end to end with no server: fix in stages, undo, message, verify, close', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'View list' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-1$/)
  await expect(panel(page).getByText('Guided demo', { exact: true })).toBeVisible()
  const exact = Number((await page.getByText(/^Exact \(\d+\)/).innerText()).match(/\d+/)![0])

  await btn(page, 'Test hook').click()
  await expect(panel(page).getByText(/Your hook answered. Your webhook is returning 401/)).toBeVisible()
  await btn(page, 'Plan the fix').click()
  await expect(panel(page).getByText(new RegExp(`^${exact} customers, ₹`))).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await expect(panel(page).getByText(new RegExp(`^5 of ${exact} confirmed active by your records`))).toBeVisible()
  await expect(page.getByText(new RegExp(`^Exact \\(${exact - 5}\\)`))).toBeVisible() // the page's own numbers move with the fix

  await btn(page, 'Undo these changes').click()
  await expect(panel(page).getByText(/Undone\. Every record is back to how it was/)).toBeVisible()
  await expect(page.getByText(new RegExp(`^Exact \\(${exact}\\)`))).toBeVisible()
  await btn(page, 'Plan the fix').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, /^Grant the rest/).click()
  await expect(panel(page).getByText(new RegExp(`^${exact} of ${exact} confirmed active`))).toBeVisible()

  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/From Kaksha payment help, powered by Razorpay/).first()).toBeVisible()
  await panel(page).getByText('Hinglish', { exact: true }).click()
  await expect(panel(page).getByText(/chalu/).first()).toBeVisible()
  await expect(panel(page).getByText(/Messaging is switched off/)).toBeVisible()
  await btn(page, 'Switch messaging on').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, /^Grant the rest/).click()
  await expect(panel(page).getByText('Sent', { exact: true })).toBeVisible()
  await expect(page.getByText('Undo these changes')).toHaveCount(0) // customers were told

  await btn(page, 'Verify and close').click()
  await expect(panel(page).getByText(/still answers 401/)).toBeVisible()
  await btn(page, 'Your developer ships the fix').click()
  await btn(page, 'Verify and close').click()
  await expect(panel(page).getByText(/0\.0 of 24 hours/)).toBeVisible()
  await btn(page, 'Move the clock forward 24 hours').click()
  await btn(page, 'Verify and close').click()
  await expect(panel(page).getByText(/Your webhook has answered normally for 24 hours\. ₹[\d,]+ restored/)).toBeVisible()
  await expect(page.getByTestId('success-moment')).toBeVisible()

  await page.getByRole('link', { name: 'Audit' }).click()
  await expect(page.getByText(/Planned grant for \d+ customers/).first()).toBeVisible()
  await expect(page.getByText(/Undid the grants/).first()).toBeVisible()
  await expect(page.getByText(/Approved rest/).first()).toBeVisible()
})

test('the stages cannot be skipped in the demo either', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  await btn(page, 'Test hook').click()
  await btn(page, 'Plan the fix').click()
  await expect(btn(page, 'Grant the first 5')).toHaveCount(0) // the dry run has to be approved first
  await expect(btn(page, 'Looks right, continue')).toBeVisible()
})

test('WhatsApp: pick a message, the agent says it is an AI, finds the payment, and the founder approves the held reply', async ({ page }) => {
  await page.goto('/chat-demo')
  await expect(page.getByPlaceholder('Type a message')).toHaveCount(0) // suggested messages only, since nothing can read free text without a server
  const chat = page.getByTestId('customer-chat')
  const founder = page.getByTestId('thread-view')
  await chat.getByRole('button', { name: /paisa kat gaya 299 ka/ }).click()
  await expect(chat.getByText(/Main ek AI hoon/)).toBeVisible()
  await expect(founder.getByText('Finding the payment')).toBeVisible()
  await chat.getByRole('button', { name: /^UPI ref pay_/ }).click()
  await expect(founder.getByText('Waiting for the fix')).toBeVisible()
  await expect(founder.getByText('Held for you')).toBeVisible()
  await expect(chat.getByText(/hume mil gaya/)).toHaveCount(0)
  await expect(founder.getByRole('button', { name: 'Reply in your own words' })).toHaveCount(0)
  await founder.getByRole('button', { name: 'Approve and send' }).click()
  await expect(chat.getByText(/ka payment hume mil gaya/)).toBeVisible()
})

test('WhatsApp: an instruction hidden in a message goes to the founder, and an unrelated one is passed back', async ({ page }) => {
  await page.goto('/chat-demo')
  const founder = page.getByTestId('thread-view')
  await page.getByTestId('customer-chat').getByRole('button', { name: /Ignore all previous instructions/ }).click()
  await expect(founder.getByText('Needs you', { exact: true })).toBeVisible()
  await expect(founder.getByText(/tried to give the system instructions/)).toBeVisible()
  await page.getByTestId('customer-chat').getByRole('button', { name: /what time does the live class start/ }).click()
  await expect(founder.getByText('Not about a payment')).toBeVisible()
})

test('help button on a receipt, and email, both play their recorded conversation', async ({ page }) => {
  await page.goto('/help-demo/receipt')
  await page.getByRole('button', { name: 'Need help with this payment?' }).click()
  await page.getByTestId('customer-chat').getByRole('button', { name: 'access nahi mila' }).click()
  await page.getByText('See it as the founder').click()
  await expect(page.getByTestId('thread-view').getByText('Waiting for the fix')).toBeVisible()
  await page.goto('/email-demo')
  await page.getByRole('button', { name: 'Send email' }).click()
  await expect(page.getByText(/12-digit UPI ref/)).toBeVisible()
})

test('messaging stays off until the founder switches it on, in the demo as in the live product', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  await btn(page, 'Test hook').click()
  await btn(page, 'Plan the fix').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/Messaging is switched off/)).toBeVisible()
})

// ---------- Hero B: customers who could not reach the pay page. Inferred, so the fix is the developer's and links wait for the founder ----------
test('Hero B plays end to end with no server: infer, check the page, fix, links in stages, what happened, close', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Your pay page is not answering/)).toBeVisible()
  await page.getByRole('button', { name: 'View evidence' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-4$/)
  await expect(page.getByText('Inferred. Your side · Code').first()).toBeVisible()
  await expect(page.getByText('Razorpay did not see this')).toBeVisible()
  await expect(page.getByText(/Inferred from 4 pieces of evidence, 5 points/)).toBeVisible()
  await expect(page.getByText(/We cannot see: Anything between the customer's device/)).toBeVisible()
  await expect(page.getByTestId('orders-chart')).toBeVisible()
  await expect(page.getByText('Instagram replies arrive in a later release.').first()).toBeVisible()

  await btn(page, 'Check the pay page now').click()
  await expect(panel(page).getByText(/HTTP 404, no checkout script. The page is still failing/)).toBeVisible()
  await btn(page, 'Plan the links').click()
  await expect(panel(page).getByText(/^8 customers, 1 of them held back on purpose/)).toBeVisible()
  await expect(panel(page).getByText(/Button: Pay the same amount/).first()).toBeVisible()
  await expect(btn(page, 'Looks right, continue')).toBeDisabled()
  await btn(page, 'Switch messaging on').click()
  await expect(panel(page).getByText(/Links go out only after the fix is confirmed. Your pay page still answers 404/)).toBeVisible()

  await btn(page, 'Your developer fixes the pay page').click()
  await btn(page, 'Move the clock forward 2 hours').click()
  await expect(panel(page).getByText('Healthy', { exact: true })).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Send the first 5').click()
  await expect(panel(page).getByText('5 of 7', { exact: true })).toBeVisible()
  await btn(page, 'Verify and close').click()
  await expect(panel(page).getByText(/Paid since: 0 of 5 customers/)).toBeVisible() // half sent: stays open
  await expect(page.getByText('Still open')).toBeVisible()
  await btn(page, /^Send the rest/).click()
  await expect(panel(page).getByText('Sent', { exact: true })).toBeVisible()

  await btn(page, 'Move the clock forward 24 hours').click()
  await expect(panel(page).getByText(/^1 of 7 customers with a link have paid, ₹2,499 recovered/)).toBeVisible()
  await btn(page, 'Move the clock forward 24 hours').click()
  await expect(panel(page).getByText(/^4 of 7 customers with a link have paid/)).toBeVisible()
  await expect(panel(page).getByText(/Held back on purpose: 0 of 1 paid on their own. Too few customers to say what the link adds/)).toBeVisible()
  await expect(panel(page).getByText(/simulated, with behaviour set in the synthetic world/)).toBeVisible()
  await btn(page, 'Verify and close').click()
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(panel(page).getByText(/4 of 8 customers paid/).or(panel(page).getByText(/customers paid/)).first()).toBeVisible()

  await page.getByRole('link', { name: 'Audit' }).click()
  await expect(page.getByText(/Planned recovery_link for 8 customers/).first()).toBeVisible()
  await expect(page.getByText(/Approved first 5: 5 of 8 done and confirmed/).first()).toBeVisible()
})

test('Hero B: links cannot be sent before the page has held for two hours, and a stage cannot be skipped', async ({ page }) => {
  await page.goto('/incidents/INC-4')
  await btn(page, 'Plan the links').click()
  await btn(page, 'Switch messaging on').click()
  await expect(btn(page, 'Looks right, continue')).toBeDisabled()
  await btn(page, 'Your developer fixes the pay page').click()
  await expect(panel(page).getByText(/0 of 2 hours/).first()).toBeVisible()
  await btn(page, 'Move the clock forward 2 hours').click()
  await expect(btn(page, 'Send the first 5')).toHaveCount(0) // the dry run has to be approved first
  await expect(btn(page, 'Looks right, continue')).toBeEnabled()
})

test('the checkout incident (INC-5) reads from the orders, and a pay-page check cannot see it', async ({ page }) => {
  await page.goto('/incidents')
  await page.getByRole('link', { name: 'Checkout would not open after the Razorpay key changed' }).click()
  await expect(page.getByText('Inferred. Your side · Setup').first()).toBeVisible()
  await expect(page.getByText(/orders were created and nobody tried to pay for them/)).toBeVisible()
  await expect(panel(page).getByText(/A page check cannot see a checkout that will not open/)).toBeVisible()
  await expect(btn(page, 'Check the pay page now')).toHaveCount(0)
})

test('a customer who cannot open the page is told it is the merchant side, in the demo', async ({ page }) => {
  await page.goto('/chat-demo')
  const founder = page.getByTestId('thread-view')
  await page.getByTestId('customer-chat').getByRole('button', { name: /ad link for Test Series says page not found/i }).click()
  await expect(founder.getByText('Waiting for the fix')).toBeVisible()
  await expect(founder.getByText('Held for you')).toBeVisible()
  await founder.getByRole('button', { name: 'Approve and send' }).click()
  await expect(page.getByTestId('customer-chat').getByText(/no money should have left your account/i)).toBeVisible()
})

// ---------- Handovers: Instagram control passing, and public posts that move to a private message ----------
test('Instagram: the inbox passes a payment thread to Blindspot, keeps what is not a payment, and takes back what needs a person', async ({ page }) => {
  await page.goto('/ig-demo')
  const chat = page.getByTestId('customer-chat')
  const founder = page.getByTestId('thread-view')
  await chat.getByRole('button', { name: /paisa kat gaya 299 ka, Premium Monthly/ }).click()
  await expect(page.getByText('Blindspot has control')).toBeVisible()
  await expect(founder.getByText(/The Meta inbox passed this conversation to Blindspot/)).toBeVisible()
  await expect(chat.getByText(/Main ek AI hoon/)).toBeVisible()
  await chat.getByRole('button', { name: /^UPI ref pay_|^UPI ref \d+/ }).click()
  await expect(founder.getByText('Waiting for the fix')).toBeVisible()
  await expect(page.getByText('Blindspot has control')).toBeVisible() // it keeps control while a fix is awaited

  await chat.getByRole('button', { name: /kal ki class ka link bhejo/ }).click()
  await expect(page.getByText('Stayed with the Meta inbox')).toBeVisible()
  await expect(founder.getByText(/Nothing was kept and nothing was said/)).toBeVisible()
  await chat.getByRole('button', { name: /consumer court/ }).click()
  await expect(page.getByText('Back with the Meta inbox')).toBeVisible()
  await expect(founder.getByText('Needs you', { exact: true })).toBeVisible()
  await expect(founder.getByText(/released this conversation to the Meta inbox/)).toBeVisible()
})

test('public post: one generic reply held for the founder, and the customer carries on privately', async ({ page }) => {
  await page.goto('/public-demo')
  const founder = page.getByTestId('thread-view').first()
  await page.getByTestId('public-posts').getByRole('button', { name: 'Show this post to Blindspot' }).first().click()
  await expect(founder.getByText('Held for you')).toBeVisible()
  await expect(founder.getByText(/Please message us privately|Kripya humein private message/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'The customer writes privately' })).toHaveCount(0) // not until the reply is posted
  await founder.getByRole('button', { name: 'Approve and send' }).click()
  await page.getByRole('button', { name: 'The customer writes privately' }).click()
  await expect(page.getByText('The private conversation')).toBeVisible()
  await expect(page.getByText(/began as a public post/)).toBeVisible()
  await expect(page.getByText(/This public thread is closed/)).toBeVisible()
})

test('public post: a real post from the research is watched and never answered, and a threat goes to a person', async ({ page }) => {
  await page.goto('/public-demo')
  const founder = page.getByTestId('thread-view').first()
  const shows = page.getByTestId('public-posts').getByRole('button', { name: 'Show this post to Blindspot' })
  await shows.nth(9).click()
  await expect(founder.getByText(/only watches it and never replies/)).toBeVisible()
  await expect(founder.getByText('Held for you')).toHaveCount(0)
  await shows.nth(8).click()
  await expect(founder.getByText(/Nothing is posted in public/)).toBeVisible()
  await expect(founder.getByText('Needs you', { exact: true })).toBeVisible()
})

test('Learning: a false alarm makes the alerts stricter at the review, with the reason, the version and an audit line', async ({ page }) => {
  await page.goto('/incidents/INC-4')
  await page.getByRole('button', { name: 'This was a false alarm' }).click()
  await expect(page.getByText(/Noted\. It is counted at the next review/)).toBeVisible()
  await page.getByRole('link', { name: 'Learning screen' }).click()
  await expect(page.getByText('No changes this week')).toBeVisible()
  await expect(page.getByText('You told me 1 false alarm this week.')).toBeVisible()
  await page.getByRole('button', { name: 'Review this week now' }).click()
  await expect(page.getByText('2 changes this week')).toBeVisible()
  await expect(page.getByText(/I made the order-dip alert stricter: .* about 1 in 200 times \(it was 1 in 100\), because 1 order-dip alert was marked false\./)).toBeVisible()
  await expect(page.getByText('v1: 1 in 200').first()).toBeVisible()
  await expect(page.getByText('Simulated', { exact: true })).toBeVisible()
  await expect(page.getByText(/Over six weeks: .* false alerts with no learning/)).toBeVisible()
  await page.getByRole('link', { name: 'Audit log' }).click()
  await expect(page.getByText(/Changed order_dip_p_threshold from 0.01 to 0.005/)).toBeVisible()
  await expect(page.getByText('Feedback: false alarm')).toBeVisible()
})

test('Learning: reporting a missed incident is a live-demo feature, and says so', async ({ page }) => {
  await page.goto('/learning')
  await page.getByRole('button', { name: 'Orders dropped and nothing alerted' }).click()
  await expect(page.getByText(/works in the live demo/)).toBeVisible()
})
