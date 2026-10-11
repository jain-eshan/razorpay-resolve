import { expect, test } from '@playwright/test'

// A person who has never heard of Blindspot meets the welcome pop-up on the overview: three slides (what it catches, whose side, you approve), then setup.
// Automated browsers skip the pop-up so it does not cover every other test; `?welcome` asks for it (lib/setup.ts).
test('the welcome pop-up walks through three slides into setup, and Take the tour opens it again', async ({ page }) => {
  await page.goto('/?welcome')
  const tour = page.getByRole('dialog', { name: 'Welcome to Blindspot' })
  await expect(tour.getByRole('heading', { name: 'Find customers who paid and got nothing' })).toBeVisible()
  await tour.getByRole('button', { name: 'Next' }).click()
  await expect(tour.getByRole('heading', { name: 'See whose side the cause is on' })).toBeVisible()
  const height = (await tour.boundingBox())?.height  // measured once the opening animation is over
  await tour.getByRole('button', { name: 'Next' }).click()
  await expect(tour.getByRole('heading', { name: 'Nothing happens until you approve it' })).toBeVisible()
  expect((await tour.boundingBox())?.height, 'the window keeps one height on every slide').toBe(height)
  await tour.getByRole('button', { name: 'Back' }).click()
  await tour.getByRole('button', { name: 'Back' }).click()
  await expect(tour.getByRole('heading', { name: 'Find customers who paid and got nothing' })).toBeVisible()
  expect((await tour.boundingBox())?.height, 'the first slide is the same height too').toBe(height)
  await tour.getByRole('button', { name: 'Next' }).click()
  await tour.getByRole('button', { name: 'Next' }).click()
  await tour.getByRole('button', { name: 'Set up in 3 steps' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await page.goto('/')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Take the tour' }).click()
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Look around first' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

// The overview guide (three slides: what it is, why, how to use it) still opens from a link and lands on setup.
test('the overview guide walks through three slides and lands on setup', async ({ page }) => {
  await page.goto('/guides/blindspot')
  await page.getByRole('button', { name: 'Read more' }).click()
  await expect(page.getByRole('heading', { name: 'What makes Blindspot great?' })).toBeVisible()
  await page.getByRole('button', { name: 'See how to use it' }).click()
  await expect(page.getByRole('heading', { name: 'How to use Blindspot' })).toBeVisible()
  for (const step of ['Answer three setup questions', 'Open a payment issue', 'Approve the fix']) await expect(page.getByTestId('guide-steps').getByText(step)).toBeVisible()
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/setup$/)
})

test('the pages that explain themselves have a How it works button that opens their guide', async ({ page }) => {
  for (const [route, guide] of [['/settings', 'autonomy'], ['/learning', 'learning'], ['/how', 'how'], ['/access', 'access'], ['/connect', 'integration'], ['/release-check', 'integration']]) {
    await page.goto(route)
    await page.getByRole('button', { name: 'How it works' }).click()
    await expect(page).toHaveURL(new RegExp(`/guides/${guide}$`))
  }
})

// Below 1280px the guide shows one slide at a time (the three slides are different heights and a carousel left a big empty band). The in-slide buttons still walk through it.
test('on a phone the guide shows one slide at a time and the buttons walk through it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/guides/incidents')
  await page.getByTestId('guide').waitFor()
  await expect(page.getByRole('heading', { name: 'Why it helps' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Read more' }).click()
  await expect(page.getByRole('heading', { name: 'Why it helps' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read more' })).toHaveCount(0)
  await page.getByRole('button', { name: 'See how to use it' }).click()
  await expect(page.getByTestId('guide-steps').getByText('Check the evidence')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { name: 'Why it helps' })).toBeVisible()
})
