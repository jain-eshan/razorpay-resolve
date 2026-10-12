import { expect, test, type Locator, type Page } from '@playwright/test'

// "How Blindspot works" (v3 batch 1.4, S1) and the copy pass (S2). Each check asserts that it found the thing before it measures it, so a selector that matches nothing fails.
const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
const box = async (l: Locator) => (await l.boundingBox())!

test('Overview links to the page, which shows two lanes of five steps and the engine', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'How Blindspot works' }).click()
  await expect(page).toHaveURL(/\/how-it-works$/)
  await expect(page.getByRole('heading', { level: 1, name: 'How Blindspot works' })).toBeVisible()
  // The five steps carry the names of the story strip on every payment issue page, in the same order, in both lanes.
  for (const lane of ['customer', 'alert']) {
    const steps = page.getByTestId(`lane-${lane}`).locator(`[data-testid^="${lane}-step-"]`)
    await expect(steps).toHaveCount(5)
    for (const [i, name] of ['Hear', 'Find everyone', 'Whose side', 'Fix', 'Win back'].entries()) await expect(steps.nth(i)).toContainText(name)
  }
  const engine = page.getByTestId('engine')
  await expect(engine.locator('[data-testid^="engine-in-"]')).toHaveCount(3)
  await expect(engine.locator('[data-testid^="engine-step-"]')).toHaveCount(5)
  await expect(engine.locator('[data-testid^="engine-out-"]')).toHaveCount(4)
})

test('what is not built says so, and AI is named only as the production design', async ({ page }) => {
  await page.goto('/how-it-works')
  // The big-brand lane, the alert door and the Slack channel do not exist as working parts: each is tagged. A fourth tag would mean a claim was softened by accident.
  await expect(page.getByText('Mock-up', { exact: true })).toHaveCount(3)
  await expect(page.getByTestId('lane-alert').getByText('Mock-up', { exact: true })).toHaveCount(1)
  await expect(page.getByTestId('engine-in-3').getByText('Mock-up', { exact: true })).toHaveCount(1)
  await expect(page.getByTestId('engine-out-2').getByText('Mock-up', { exact: true })).toHaveCount(1)
  await expect(page.getByText('No AI model is run.')).toBeVisible()
  await expect(page.getByTestId('today').getByText('Built', { exact: true })).toBeVisible()
  await expect(page.getByTestId('production').getByText('Design only', { exact: true })).toBeVisible()
  await expect(page.getByTestId('today').getByText(/AI model reads/)).toHaveCount(0)  // the model belongs to the production side only
  await expect(page.getByTestId('production').getByText(/AI model reads/)).toHaveCount(1)
})

test('the way in and out: the menu keeps Overview marked, the crumb, the buttons and the browser Back all lead somewhere real', async ({ page }) => {
  await page.goto('/how-it-works')
  // /how is Accuracy. A menu item that matched by prefix would light up Accuracy here too.
  await expect(page.getByRole('link', { name: 'Overview' }).first()).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Accuracy' })).not.toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'See where rules fail' }).click()
  await expect(page).toHaveURL(/\/how$/)
  await expect(page.getByRole('heading', { name: 'Where rules fail' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Accuracy' })).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await page.getByRole('button', { name: 'See a payment issue' }).click()
  await expect(page).toHaveURL(/\/incidents\/INC-1$/)
  await expect(page.getByTestId('story-strip')).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: 'Back to Overview' }).click()
  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  await page.goBack()
  await page.getByTestId('page').getByRole('link', { name: 'Overview' }).click()  // the crumb (the menu's own item is also called Overview)
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
})

// Lanes and the engine choose their layout from their own width (960px). Measured at the widths where it changes hands: the lane is about 1072px at 1440, about 930px at 1280.
for (const [width, wide] of [[1440, true], [1280, false], [1024, false], [768, false], [375, false]] as const) {
  test(`layout at ${width}px: ${wide ? 'steps in a row, engine in three columns' : 'steps stacked, engine stacked'}, nothing clipped or sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/how-it-works')
    await page.getByTestId('lane-customer').waitFor()
    await settle(page)
    for (const lane of ['customer', 'alert']) {
      const steps = page.getByTestId(`lane-${lane}`).locator(`[data-testid^="${lane}-step-"]`)
      expect(await steps.count()).toBe(5)
      const boxes = await Promise.all([0, 1, 2, 3, 4].map((i) => box(steps.nth(i))))
      const laneBox = await box(page.getByTestId(`lane-${lane}`))
      for (const b of boxes) expect(b.x + b.width, 'a step runs past its lane').toBeLessThanOrEqual(laneBox.x + laneBox.width + 1)
      if (wide) {
        expect(new Set(boxes.map((b) => Math.round(b.y))).size, 'five steps share one row').toBe(1)
        expect(new Set(boxes.map((b) => Math.round(b.height))).size, 'the five boxes are one height').toBe(1)
        for (const b of boxes) expect(b.width, 'a step has room for its words').toBeGreaterThanOrEqual(150)
      } else {
        for (let i = 1; i < 5; i++) expect(boxes[i].y, 'steps stack in order').toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].height - 1)
      }
    }
    // No box cuts its own words off: its content is never taller than the box.
    const clipped = await page.getByTestId('page').evaluate((el) => [...el.querySelectorAll('[data-testid]')].filter((n) => /-step-\d$|^engine-(in|out)-\d$/.test(n.getAttribute('data-testid') ?? '') && n.scrollHeight > n.clientHeight + 1).map((n) => n.getAttribute('data-testid')))
    expect(clipped).toEqual([])
    const [i1, s1, o1, i3, o4, s5] = await Promise.all(['engine-in-1', 'engine-step-1', 'engine-out-1', 'engine-in-3', 'engine-out-4', 'engine-step-5'].map((id) => box(page.getByTestId(id))))
    if (wide) {
      expect(i1.x + i1.width, 'inputs sit left of the steps').toBeLessThanOrEqual(s1.x)
      expect(s1.x + s1.width, 'the steps sit left of the outputs').toBeLessThanOrEqual(o1.x)
      expect(Math.abs(i1.y - o1.y), 'inputs and outputs start on one line').toBeLessThan(40)
      expect(i3.y + i3.height, 'the three columns end together').toBeCloseTo(o4.y + o4.height, -1)
      expect(s5.y, 'the five steps run down the middle').toBeGreaterThan(s1.y)
    } else {
      expect(s1.y, 'steps come after the inputs').toBeGreaterThan(i3.y + i3.height)
      expect(o1.y, 'outputs come after the steps').toBeGreaterThan(s5.y + s5.height)
    }
    const spill = await page.getByTestId('page').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(spill).toBeLessThanOrEqual(1)
  })
}

// S2: the copy pass changed words, not sizes. The nine Explore cards were one height at 1440 and at 375px; a longer line would wrap and make them uneven.
for (const width of [1440, 375]) {
  test(`the nine Explore cards stay one height at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const cards = page.getByRole('heading', { name: 'Explore Blindspot' }).locator('xpath=following-sibling::*[1]').locator('[data-blade-component="card"]')
    await expect(cards).toHaveCount(9)
    await settle(page)
    const heights = await Promise.all([...Array(9).keys()].map(async (i) => Math.round((await box(cards.nth(i))).height)))
    expect(new Set(heights), `heights ${heights.join(', ')}`).toEqual(new Set([heights[0]]))
  })
}

test('the Overview says the pitch with the link to this page beside it, and the header holds together at every width', async ({ page }) => {
  for (const width of [1440, 1280, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByText('Blindspot finds everyone a payment problem hit, says whose side it is, and wins them back.')).toBeVisible()
    await settle(page)
    const pageBox = await box(page.getByTestId('page'))
    const link = await box(page.getByRole('link', { name: 'How Blindspot works' }))
    expect(link.x, `link at ${width}px`).toBeGreaterThanOrEqual(pageBox.x)
    expect(link.x + link.width, `link at ${width}px`).toBeLessThanOrEqual(pageBox.x + pageBox.width + 1)
    // The link sits with the pitch, inside the header, above the Ray field and the cards.
    expect(link.y, `link at ${width}px`).toBeLessThan((await box(page.getByTestId('home-cards'))).y)
    const names = ['Take a tour', 'Reset setup']
    for (const name of names) {
      const b = await box(page.getByRole('button', { name }))
      expect(b.x + b.width, `${name} at ${width}px`).toBeLessThanOrEqual(pageBox.x + pageBox.width + 1)
      expect(b.height, `${name} is a 36px target at ${width}px`).toBeGreaterThanOrEqual(36)
    }
  }
})
