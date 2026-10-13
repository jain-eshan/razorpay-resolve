import { expect, test, type Page } from '@playwright/test'

// The guided demo: the hosted site has no server, so these run against the static snapshot and the frames recorded from the real engine.
// A full page load starts the demo over, so the tests move around with in-app links.

const panel = (page: Page) => page.getByTestId('fix-panel')
const btn = (page: Page, name: string | RegExp) => panel(page).getByRole('button', { name })

test('Hero A plays end to end with no server: fix in stages, undo, message, verify, close', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'View list' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-1$/)
  await expect(panel(page).getByText('Demo', { exact: true })).toBeVisible()
  const exact = Number((await page.getByText(/^Certain \(\d+\)/).innerText()).match(/\d+/)![0])

  await btn(page, 'Run the check').click()
  await expect(panel(page).getByText(/Your app answered. Your webhook is returning 401/)).toBeVisible()
  await btn(page, 'Plan the fix').click()
  await expect(panel(page).getByText(new RegExp(`^${exact} customers, ₹`))).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await expect(panel(page).getByText(new RegExp(`^5 of ${exact} confirmed active by your records`))).toBeVisible()
  await expect(page.getByText(new RegExp(`^Certain \\(${exact - 5}\\)`))).toBeVisible() // the page's own numbers move with the fix

  await btn(page, 'Undo these changes').click()
  await expect(panel(page).getByText(/Undone\. Every record is back to how it was/)).toBeVisible()
  await expect(page.getByText(new RegExp(`^Certain \\(${exact}\\)`))).toBeVisible()
  await btn(page, 'Plan the fix').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, /^Grant the rest/).click()
  await expect(panel(page).getByText(new RegExp(`^${exact} of ${exact} confirmed active`))).toBeVisible()

  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/From Kaksha payment help, powered by Razorpay/).first()).toBeVisible()
  await expect(panel(page).getByRole('group', { name: /^WhatsApp chat with Kaksha payment help/ }).first()).toBeVisible() // the message is shown as the customer will see it
  await panel(page).getByText('Hinglish', { exact: true }).click()
  await expect(panel(page).getByText(/chalu/).first()).toBeVisible()
  await expect(panel(page).getByText(/Messaging is switched off/)).toBeVisible()
  await btn(page, 'Switch messaging on').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, /^Grant the rest/).click()
  await expect(panel(page).getByText('Sent', { exact: true })).toBeVisible()
  await expect(panel(page).getByTestId('approved').filter({ hasText: /^Sent to \d+ customers/ })).toBeVisible() // the button became a green tick
  await expect(page.getByText('Undo these changes')).toHaveCount(0) // customers were told

  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/still answers 401/)).toBeVisible()
  await btn(page, 'Your developer ships the fix').click()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/0\.0 of 24 hours/)).toBeVisible()
  await btn(page, 'Move the clock forward 24 hours').click()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/Your webhook has answered normally for 24 hours\. ₹[\d,]+ restored/)).toBeVisible()
  await expect(page.getByTestId('success-moment')).toBeVisible()

  await page.getByRole('link', { name: 'Audit' }).click()
  await expect(page.getByText(/Planned grant for \d+ customers/).first()).toBeVisible()
  await expect(page.getByText(/Undid the grants/).first()).toBeVisible()
  await expect(page.getByText(/Approved rest/).first()).toBeVisible()
})

test('the stages cannot be skipped in the demo either', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  await btn(page, 'Run the check').click()
  await btn(page, 'Plan the fix').click()
  await expect(btn(page, 'Grant the first 5')).toHaveCount(0) // the test run has to be approved first
  await expect(btn(page, 'Looks right, continue')).toBeVisible()
})

// The WhatsApp demo is a guided story: four steps, the next message to send, and one line on the right that says what happened and why.
const step = (page: Page, n: number) => page.getByTestId(`chat-step-${n}`)
const outcome = (page: Page) => page.getByTestId('chat-outcome').getByRole('heading')
// Each tile's size, measured one by one (the strip takes its tallest tile's height, so measuring the strip alone would hide a tile that grew)
const tiles = (page: Page) => Promise.all([1, 2, 3, 4].map(async (n) => { const b = await step(page, n).boundingBox(); return b && [b.width, b.height] }))

test('WhatsApp: the main story, step by step: the agent says it is an AI, finds the payment, and the founder approves the held reply', async ({ page }) => {
  await page.goto('/chat-demo')
  await expect(page.getByPlaceholder('Type a message')).toHaveCount(0) // suggested messages only, since nothing can read free text without a server
  const chat = page.getByTestId('customer-chat')
  const founder = page.getByTestId('thread-view')
  const next = page.getByTestId('next-message')
  // Before anything is sent, your side says what will appear, and step 1 is the one to do
  await expect(page.getByTestId('view-waiting')).toBeVisible()
  await expect(outcome(page)).toHaveText("Waiting for the customer's first message")
  await expect(step(page, 1)).toContainText('Now')
  await expect(step(page, 2)).toContainText('Next')
  const size = await tiles(page)
  expect(size.every((b) => b && b[1] > 40)).toBe(true)

  await next.getByRole('button', { name: /^Send: paisa kat gaya 299 ka/ }).click()
  await expect(chat.getByText(/Main ek AI hoon/)).toBeVisible()
  await expect(founder.getByText('Finding the payment')).toBeVisible()
  await expect(outcome(page)).toHaveText('Asked for the UPI ref')
  await expect(page.getByTestId('chat-outcome')).toContainText('never an OTP or PIN')
  await expect(step(page, 1)).toContainText('Done')
  await expect(step(page, 2)).toContainText('Now')

  await next.getByRole('button', { name: /^Send: UPI ref \d{12}$/ }).click()  // the 12-digit reference the agent asked for, not a payment id
  await expect(founder.getByText('Waiting for the fix')).toBeVisible()
  await expect(outcome(page)).toHaveText('Found the ₹299 payment')  // the amount is the reply's own slot, not typed into the page
  await expect(page.getByTestId('chat-outcome')).toContainText('Premium Monthly is not on, so the reply is waiting for your approval')
  await expect(step(page, 3)).toContainText('Now')
  await expect(next.getByRole('button', { name: /^Send/ })).toHaveCount(0)  // nothing for the customer to send while the reply waits
  await expect(page.getByText(/\[[A-Z0-9_]+_\d+\]/)).toHaveCount(0)  // no raw [RRN_1] style token on screen
  await expect(founder.getByText(/UPI ref \(hidden\)/).first()).toBeVisible()  // not 'UPI ref UPI reference (hidden)'
  await expect(founder.getByText('Held for you')).toBeVisible()
  await expect(chat.getByText(/hume mil gaya/)).toHaveCount(0)
  await expect(founder.getByRole('button', { name: 'Reply in your own words' })).toHaveCount(0)
  await founder.getByRole('button', { name: 'Approve and send' }).click()
  await expect(chat.getByText(/ka payment hume mil gaya/)).toBeVisible()
  await expect(outcome(page)).toHaveText('Reply sent')
  await expect(step(page, 4)).toContainText('Done')
  expect(await tiles(page)).toEqual(size)  // every tile keeps its size through the story
})

test('WhatsApp: another case pauses the main story, and the story goes on where it stopped with the right messages on the phone', async ({ page }) => {
  await page.goto('/chat-demo')
  const phone = page.getByTestId('customer-chat').getByRole('group')
  await page.getByTestId('next-message').getByRole('button', { name: /^Send: paisa kat gaya/ }).click()
  await expect(outcome(page)).toHaveText('Asked for the UPI ref')
  await page.getByRole('button', { name: 'Send: A message that tries to trick it' }).click()
  await expect(outcome(page)).toHaveText('Sent to you. Nothing was refunded.')
  await expect(page.getByText('Paused while you try another case.')).toBeVisible()
  await expect(step(page, 2)).toContainText('Now')  // the story keeps its place
  await page.getByTestId('next-message').getByRole('button', { name: /^Send: UPI ref/ }).click()
  await expect(outcome(page)).toHaveText('Found the ₹299 payment')
  // Typed messages are kept per conversation: the phone shows this customer's first message, not the one from the other case
  await expect(phone.getByText('paisa kat gaya 299 ka, Premium Monthly nahi mila')).toBeVisible()
  await expect(phone.getByText(/Ignore all previous instructions/)).toHaveCount(0)
})

test('WhatsApp: an instruction hidden in a message goes to the founder and nothing is refunded, and an unrelated one is passed back', async ({ page }) => {
  await page.goto('/chat-demo')
  const chat = page.getByTestId('customer-chat')
  const founder = page.getByTestId('thread-view')
  await page.getByRole('button', { name: 'Send: A message that tries to trick it' }).click()
  await expect(founder.getByText('Needs you', { exact: true })).toBeVisible()
  await expect(founder.getByText(/tried to give the system instructions/)).toBeVisible()
  await expect(outcome(page)).toHaveText('Sent to you. Nothing was refunded.')
  await expect(chat.getByRole('group').getByText(/refund/i)).toHaveCount(1)  // on the phone, only the customer's own message says refund
  await expect(chat.getByText(/passed this to Kaksha's team/)).toBeVisible()
  await expect(page.getByTestId('other-cases').getByText('On the phone')).toHaveCount(1)
  await page.getByRole('button', { name: 'Send: Not about a payment' }).click()
  await expect(founder.getByText('Not about a payment')).toBeVisible()
  await expect(outcome(page)).toHaveText('Not about a payment, so passed back')
  await expect(chat.getByRole('group').getByText('what time does the live class start tomorrow?')).toBeVisible()  // the customer still sees what they sent
})

test('help button on a receipt, and email, both play their recorded conversation', async ({ page }) => {
  await page.goto('/help-demo/receipt')
  await page.getByRole('button', { name: 'Need help with this payment?' }).click()
  await page.getByTestId('customer-chat').getByRole('button', { name: 'access nahi mila' }).click()
  await page.getByText('See it as you would').click()
  await expect(page.getByTestId('thread-view').getByText('Waiting for the fix')).toBeVisible()
  await page.goto('/email-demo')
  await page.getByRole('button', { name: 'Send email' }).click()
  await expect(page.getByText(/12-digit UPI ref/)).toBeVisible()
})

test('messaging stays off until the founder switches it on, in the demo as in the live product', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  await btn(page, 'Run the check').click()
  await btn(page, 'Plan the fix').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/Messaging is switched off/)).toBeVisible()
})

// ---------- Hero B: customers who could not reach the pay page. Inferred, so the fix is the developer's and links wait for the founder ----------
test('Hero B plays end to end with no server: infer, check the page, fix, links in stages, what happened, close', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Could not pay at all', { exact: true }).click({ force: true })  // the home shows one clip at a time; pick this problem first
  await expect(page.getByText(/Your pay page stopped answering/)).toBeVisible()
  await page.getByRole('button', { name: 'View evidence' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-4$/)
  await expect(page.getByText('Your code · estimated').first()).toBeVisible()
  await expect(page.getByText('Razorpay could not see this')).toBeVisible()
  await expect(page.getByText('4 signals, strongest first')).toBeVisible()
  await expect(page.getByTestId('cannot-see').getByText(/^Anything between the customer's device/)).toBeVisible()
  await expect(page.getByTestId('orders-chart')).toBeVisible()
  await expect(page.getByText('Instagram replies arrive in a later release.').first()).toBeVisible()

  await btn(page, 'Check the pay page now').click()
  await expect(panel(page).getByText(/HTTP 404, no checkout script. The page is still failing/)).toBeVisible()
  // Links are locked until the page has held for 2 hours, and the step says why instead of looking dead.
  await expect(btn(page, 'Plan the links')).toBeDisabled()
  await expect(panel(page).getByTestId('links-locked')).toHaveText('Fix your pay page first, then wait for 2 hours of healthy checks.')

  await btn(page, 'Your developer fixes the pay page').click()
  await btn(page, 'Move the clock forward 2 hours').click()
  await expect(panel(page).getByText('Healthy', { exact: true })).toBeVisible()
  await btn(page, 'Plan the links').click()
  await expect(panel(page).getByText(/^8 customers, 1 of them held back on purpose/)).toBeVisible()
  await expect(panel(page).getByText(/^The plan is ready and nothing has been sent/)).toBeVisible()
  await expect(panel(page).getByText(/Button: Pay the same amount/).first()).toBeVisible()
  await expect(btn(page, 'Looks right, continue')).toBeDisabled()
  await expect(panel(page).getByText(/Messaging is switched off/)).toBeVisible()  // what holds it back is said, with the way to clear it
  await btn(page, 'Switch messaging on').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Send the first 5').click()
  await expect(panel(page).getByText('5 of 7', { exact: true })).toBeVisible()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/Paid since: 0 of 5 customers/)).toBeVisible() // half sent: stays open
  await expect(page.getByText('Still open', { exact: true })).toBeVisible()
  await btn(page, /^Send the rest/).click()
  await expect(panel(page).getByText('Sent', { exact: true })).toBeVisible()

  await btn(page, 'Move the clock forward 24 hours').click()
  await expect(panel(page).getByText(/^1 of 7 customers with a link have paid, ₹2,499 recovered/)).toBeVisible()
  await btn(page, 'Move the clock forward 24 hours').click()
  await expect(panel(page).getByText(/^4 of 7 customers with a link have paid/)).toBeVisible()
  await expect(panel(page).getByText(/Held back on purpose: 0 of 1 paid on their own. Too few customers to say what the link adds/)).toBeVisible()
  await expect(panel(page).getByText(/simulated, with behaviour set in the synthetic world/)).toBeVisible()
  await btn(page, 'Check it held and close').click()
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(panel(page).getByText(/4 of 8 customers paid/).or(panel(page).getByText(/customers paid/)).first()).toBeVisible()

  await page.getByRole('link', { name: 'Audit' }).click()
  await expect(page.getByText(/Planned recovery_link for 8 customers/).first()).toBeVisible()
  await expect(page.getByText(/Approved first 5: 5 of 8 done and confirmed/).first()).toBeVisible()
})

test('Hero B: links cannot be planned before the page has held for two hours, the lock says why, and a stage cannot be skipped', async ({ page }) => {
  await page.goto('/incidents/INC-4')
  await expect(btn(page, 'Plan the links')).toBeDisabled()
  await expect(panel(page).getByTestId('links-locked')).toContainText('Fix your pay page first')
  await btn(page, 'Your developer fixes the pay page').click()
  await expect(panel(page).getByTestId('links-locked')).toHaveText('Your pay page has answered normally for 0 of 2 hours. Links unlock after 2 hours.')
  await expect(btn(page, 'Plan the links')).toBeDisabled()
  await btn(page, 'Move the clock forward 2 hours').click()
  await expect(panel(page).getByTestId('links-locked')).toHaveCount(0)
  await btn(page, 'Plan the links').click()
  await btn(page, 'Switch messaging on').click()
  await expect(btn(page, 'Send the first 5')).toHaveCount(0) // the test run has to be approved first
  await expect(btn(page, 'Looks right, continue')).toBeEnabled()
})

test('the checkout issue (INC-5) reads from the orders, and a pay-page check cannot see it', async ({ page }) => {
  await page.goto('/incidents')
  await page.getByRole('link', { name: 'About 12 customers could not pay' }).click()
  await expect(page.getByText('Checkout would not open after the Razorpay key changed', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Your settings · estimated').first()).toBeVisible()
  await expect(page.getByText(/orders were created and nobody tried to pay for them/)).toBeVisible()
  await expect(panel(page).getByText(/A page check cannot see a checkout that will not open/)).toBeVisible()
  await expect(btn(page, 'Check the pay page now')).toHaveCount(0)
})

test('a customer who cannot open the page is told it is the merchant side, in the demo', async ({ page }) => {
  await page.goto('/chat-demo')
  const founder = page.getByTestId('thread-view')
  await page.getByRole('button', { name: 'Send: Could not pay' }).click()
  await expect(founder.getByText('Waiting for the fix')).toBeVisible()
  await expect(founder.getByText('Held for you')).toBeVisible()
  await expect(outcome(page)).toHaveText('No payment to find')
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
  await chat.getByRole('button', { name: /^UPI ref \d{12}$/ }).click()
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
  await expect(page.getByText(/Noted\. It is counted at the next weekly review/)).toBeVisible()
  await page.getByRole('link', { name: 'Alert tuning' }).last().click()
  await expect(page.getByText('No changes this week')).toBeVisible()
  await expect(page.getByText('You told me 1 false alarm this week.')).toBeVisible()
  await page.getByRole('button', { name: 'Review this week now' }).click()
  await expect(page.getByText('2 changes this week')).toBeVisible()
  await expect(page.getByText(/I made the order-dip alert stricter: .* about 1 in 200 times \(it was 1 in 100\), because 1 order-dip alert was marked false\./)).toBeVisible()
  await expect(page.getByText('v1: 1 in 200').first()).toBeVisible()
  await expect(page.getByText('Simulated', { exact: true })).toBeVisible()
  await expect(page.getByText(/Over six weeks: .* false alerts with no tuning/)).toBeVisible()
  await page.getByRole('link', { name: 'Audit trail' }).first().click()
  await expect(page.getByText(/Changed order_dip_p_threshold from 0.01 to 0.005/)).toBeVisible()
  await expect(page.getByText('Feedback: false alarm')).toBeVisible()
})

test('Alert tuning: reporting a missed alert is a live feature, and the demo says so', async ({ page }) => {
  await page.goto('/learning')
  await page.getByRole('button', { name: 'Orders dropped and nothing alerted' }).click()
  await expect(page.getByText(/works in the live version/)).toBeVisible()
})

// ---------- INC-3: card renewals that failed on Razorpay's side. Not inferred, not the merchant's: keep access on, tell the customers, send the evidence ----------
test('INC-3 plays end to end with no server: why it is Razorpay\'s, access kept in stages, customers told, evidence sent, closed', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Renewals failed at Razorpay', { exact: true }).click({ force: true })  // the home shows one clip at a time; pick this problem first
  await expect(page.getByText(/Card renewals are failing with a gateway error/)).toBeVisible()
  await page.getByRole('button', { name: 'See what failed' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-3$/)
  await expect(page.getByText("This one is on Razorpay's side")).toBeVisible()
  await expect(page.getByText('6 signals pointing at Razorpay, strongest first')).toBeVisible()
  await expect(page.getByTestId('cannot-see').getByText(/^Why the gateway returned the error/)).toBeVisible()
  await expect(page.getByTestId('renewal-chart')).toBeVisible()
  await expect(page.getByText(/Paid since/).first()).toBeVisible() // the customers who paid again are listed, with the reason, and left out

  await btn(page, 'Plan the extension').click()
  await expect(panel(page).getByText(/^24 customers, ₹7,176 of renewals/)).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Keep access on for the first 5').click()
  await expect(panel(page).getByText('5 of 24', { exact: true })).toBeVisible()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/19 are still waiting for the next step/)).toBeVisible() // half done stays open
  await expect(page.getByText('Still open', { exact: true })).toBeVisible()
  await btn(page, /^Keep access on for the rest/).click()
  await expect(panel(page).getByText('Done', { exact: true })).toBeVisible()

  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/not your card/).first()).toBeVisible()
  await btn(page, 'Switch messaging on').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Send the first 5').click()
  await btn(page, 'Send the rest').click()
  await expect(panel(page).getByText('Sent', { exact: true })).toBeVisible()
  await expect(btn(page, 'Undo these changes')).toHaveCount(0) // once customers are told, the extension cannot be undone

  await btn(page, 'Draft the evidence pack').click()
  await expect(panel(page).getByText(/Reference MG-INC-3-/)).toBeVisible()
  await expect(panel(page).getByText(/27 payments failed with GATEWAY_ERROR/)).toBeVisible()
  await btn(page, 'Send to Razorpay').click()
  await expect(panel(page).getByText(/Sent to Razorpay \(simulated\) as MG-INC-3-/)).toBeVisible()
  await expect(panel(page).getByText(/Already tried: Kept access on for 24 customers/)).toBeVisible()

  // the renewal link the message promised: for the customers who were told, 2 held back on purpose, in stages, then what the simulated customers did
  await btn(page, 'Plan the links').click()
  await expect(panel(page).getByText(/^24 customers, 2 of them held back on purpose/)).toBeVisible()
  await expect(panel(page).getByText(/payment network issue is fixed/).first()).toBeVisible()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Send the first 5').click()
  await btn(page, /^Send the rest/).click()
  await expect(panel(page).getByText(/^0 of 22 customers with a link have renewed/)).toBeVisible()
  await btn(page, 'Move the demo clock forward 48 hours').click()
  await expect(panel(page).getByText(/^12 of 22 customers with a link have renewed, ₹3,588 collected/)).toBeVisible()
  await expect(panel(page).getByText(/Too few customers to say what the link adds/)).toBeVisible()

  await btn(page, 'Check it held and close').click()
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(panel(page).getByText(/24 of 24 confirmed to have access by your records/).first()).toBeVisible()
  await expect(panel(page).getByText(/Renewed since: 12 of 24 customers/).first()).toBeVisible()

  await page.getByRole('link', { name: 'Audit' }).click()
  await expect(page.getByText(/Sent the evidence pack MG-INC-3-.* to Razorpay \(mock\) for 27 payments/).first()).toBeVisible()
  await expect(page.getByText(/Approved first 5: 5 of 24 done and confirmed/).first()).toBeVisible()
})

test('INC-3: the extension can be undone before the customers are told, and planned again', async ({ page }) => {
  await page.goto('/incidents/INC-3')
  await btn(page, 'Plan the extension').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Keep access on for the first 5').click()
  await btn(page, 'Undo these changes').click()
  await expect(panel(page).getByText(/Undone. Every record is back to how it was/)).toBeVisible()
  await btn(page, 'Plan the extension').click()
  await expect(panel(page).getByText('Waiting for you')).toBeVisible()
})


// ---------- INC-2: customers charged twice. On the merchant's side (the app), the second charge is refunded one customer at a time, and a refund cannot be undone ----------
test('INC-2 plays end to end with no server: why, who was left out, refunds one by one, the bank, customers told, the fix, closed', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('ray-whatsapp').getByText('Charged twice', { exact: true }).click({ force: true })  // the home shows one clip at a time; pick this problem first
  await expect(page.getByText(/Customers are being charged twice/)).toBeVisible()
  await page.getByRole('button', { name: 'See who was charged twice' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-2$/)
  await expect(page.getByText('Your webhook was fine. The second charge is the problem')).toBeVisible()
  await expect(page.getByText('6 signals pointing at your side, strongest first')).toBeVisible()
  await expect(page.getByTestId('cannot-see').getByText(/^Whether the customer meant to buy twice/)).toBeVisible()
  await expect(page.getByTestId('duplicate-chart')).toBeVisible()
  await page.getByText(/^Left out \(5\)/).click()
  await expect(page.getByText(/Two seats for two people/).first()).toBeVisible() // the look-alikes are listed, with the reason, and not touched
  await expect(page.getByText(/second attempt failed/i).first()).toBeVisible()

  await btn(page, 'Plan the refunds').click()
  await expect(panel(page).getByText(/^15 customers, ₹4,985 to go back/)).toBeVisible()
  await expect(btn(page, /^Refund ₹/).first()).toBeDisabled() // nothing can be refunded before the list is approved
  await btn(page, 'Looks right, continue').click()
  await expect(panel(page).getByText('Test run approved')).toBeVisible()
  await expect(btn(page, /^Refund ₹/).nth(1)).toBeDisabled() // the hosted demo goes in the order shown
  for (let i = 1; i <= 15; i++) {
    await btn(page, /^Refund ₹/).first().click()
    await expect(panel(page).getByText('Pending', { exact: true })).toHaveCount(i)
  }
  await expect(panel(page).getByText('15 refunds started')).toBeVisible()
  await expect(btn(page, /^Refund ₹/)).toHaveCount(0)
  await expect(btn(page, /undo/i)).toHaveCount(0) // a refund cannot be undone, so there is no button for it

  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/The app still lets the Pay button be tapped twice/)).toBeVisible()
  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/hosted demo, tell the customers once every refund has its bank reference/)).toBeVisible()
  await btn(page, 'Move the clock forward 72 hours').click()
  await expect(panel(page).getByText('Processed', { exact: true })).toHaveCount(15)
  await expect(panel(page).getByText(/^(RRN \d{12}|ARN \d{23})$/).first()).toBeVisible()

  await btn(page, 'Preview the message').click()
  await expect(panel(page).getByText(/Refund ID: rfnd_/).first()).toBeVisible()
  await btn(page, 'Switch messaging on').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Send the first 5').click()
  await btn(page, /^Send the rest/).click()
  await expect(panel(page).getByText('Sent to 15 customers')).toBeVisible()

  await btn(page, 'Your developer ships the fix').click()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/Verify again later/)).toBeVisible()
  await expect(page.getByText('Still open', { exact: true })).toBeVisible()
  await btn(page, 'Move the clock forward 24 hours').click()
  await btn(page, 'Check it held and close').click()
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(panel(page).getByText(/₹4,985 returned/).first()).toBeVisible()

  await page.getByRole('link', { name: 'Audit' }).click()
  await expect(page.getByText(/Refunded ₹599 to the original upi method\. Refund rfnd_.* This cannot be undone/).first()).toBeVisible()
  await expect(page.getByText(/Approved the refund for pay_.* 15 of 15 refunded/).first()).toBeVisible()
})

test('INC-2: the hosted demo takes the clock only after the refunds, and refunds go in the order shown', async ({ page }) => {
  await page.goto('/incidents/INC-2')
  await btn(page, 'Plan the refunds').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, /^Refund ₹/).first().click()
  await btn(page, 'Move the clock forward 3 hours').click()
  await expect(panel(page).getByText(/hosted demo, refund all the customers first/)).toBeVisible()
})

// The release check follows what the user has fixed: the webhook fixed on INC-1 turns its three steps green, and the pay page keeps it on hold until INC-4's page is fixed too.
test('the release check turns green for the webhook once its developer ships the fix, and the pay page keeps it on hold', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'View list' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-1$/)
  await btn(page, 'Run the check').click()
  await btn(page, 'Plan the fix').click()
  await btn(page, 'Looks right, continue').click()
  await btn(page, 'Grant the first 5').click()
  await btn(page, /^Grant the rest/).click()
  await btn(page, 'Check it held and close').click()
  await expect(panel(page).getByText(/still answers 401/)).toBeVisible()
  await btn(page, 'Your developer ships the fix').click()
  await page.getByRole('link', { name: 'Integration' }).first().click()
  await page.getByText('2. Go-live check').click()
  await expect(page).toHaveURL(/\/release-check$/)
  await expect(page.getByText('Passed', { exact: true })).toHaveCount(3)  // answers, accepts, acknowledges
  await expect(page.getByText('Failed', { exact: true })).toHaveCount(1)  // the pay page is still a 404
  await expect(page.getByText('Hold the release', { exact: true }).first()).toBeVisible()
})
