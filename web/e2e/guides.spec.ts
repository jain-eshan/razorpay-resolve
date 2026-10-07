import { expect, test } from '@playwright/test'

// The product guides: a person who has never heard of Blindspot finds the tour on the home, reads three slides (what it is, why, how to use it) and lands on setup.
test('the welcome tour walks through three slides and stays on the home', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('tour-card').getByRole('button', { name: 'Take the tour' }).click()
  await expect(page).toHaveURL(/\/guides\/blindspot$/)
  await page.getByRole('button', { name: 'Read more' }).click()
  await expect(page.getByRole('heading', { name: 'What makes Blindspot great?' })).toBeVisible()
  await page.getByRole('button', { name: 'See how to use it' }).click()
  await expect(page.getByRole('heading', { name: 'How to use Blindspot' })).toBeVisible()
  for (const step of ['Answer three setup questions', 'Open an incident', 'Approve the fix']) await expect(page.getByTestId('guide-steps').getByText(step)).toBeVisible()
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await page.goto('/')
  await expect(page.getByTestId('tour-card')).toBeVisible()
})

test('the pages that explain themselves have a How it works button that opens their guide', async ({ page }) => {
  for (const [route, guide] of [['/settings', 'autonomy'], ['/learning', 'learning'], ['/how', 'how']]) {
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
  await expect(page.getByRole('heading', { name: 'What makes Incidents great?' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Read more' }).click()
  await expect(page.getByRole('heading', { name: 'What makes Incidents great?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read more' })).toHaveCount(0)
  await page.getByRole('button', { name: 'See how to use it' }).click()
  await expect(page.getByTestId('guide-steps').getByText('Check the evidence')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { name: 'What makes Incidents great?' })).toBeVisible()
})
