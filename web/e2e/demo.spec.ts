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
