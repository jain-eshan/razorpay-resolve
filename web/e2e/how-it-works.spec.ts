import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

// "How Resolve works", Resolve's landing page (v3 batch 1.5, T3): the hero with a way into each account, the two journeys, the engine, "Why an AI agent" (moved here
// from Accuracy) and "Today and in production". Each check asserts that it found the thing before it measures it, so a selector that matches nothing fails.
const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
const box = async (l: Locator) => (await l.boundingBox())!
const report = JSON.parse(readFileSync('public/snapshot/eval/report.json', 'utf8')) as { metrics: { name: string; value: number | null; target: string }[] }
const metric = (n: string) => report.metrics.find((x) => x.name === n)!
const STEPS = ['Hear', 'Find everyone', 'Whose side', 'Fix', 'Win back']
// Blade's primary blue is about rgb(19, 100, 241): the names of the visible buttons with that fill (as e2e/incident.spec.ts counts them).
const blueButtons = (page: Page) => page.evaluate(() => [...document.querySelectorAll('main button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => ({ name: b.textContent, bg: getComputedStyle(b).backgroundColor })).filter((b) => { const m = b.bg.match(/\d+/g)?.map(Number) ?? []; return m.length >= 3 && m[2] > 200 && m[0] < 80 && m[1] < 140 }).map((b) => b.name))

// The page's entrance motion is still for anyone who asks for less motion; the layout checks measure the still page, so a box mid-rise is not measured.
test.use({ reducedMotion: 'reduce' })

test('Overview links to the landing page: the pitch, one blue button, and the two journeys with the five steps', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'How Resolve works' }).click()
  await expect(page).toHaveURL(/\/how-it-works$/)
  await expect(page.getByRole('heading', { level: 1, name: /Find everyone a broken payment hit, and win them back/ })).toBeVisible()
  await expect(page.getByTestId('hero').getByRole('img')).toHaveAttribute('alt', /payment path/)
  await settle(page)
  expect(await blueButtons(page), 'the one blue button is the hero\'s first way in').toEqual(['See it as Kaksha'])
  for (const id of ['kaksha', 'flipkart']) {
    const steps = page.getByTestId(`journey-${id}`).locator(`[data-testid^="${id}-step-"]`)
    await expect(steps).toHaveCount(5)
    for (const [i, name] of STEPS.entries()) await expect(steps.nth(i)).toContainText(name)
  }
  await expect(page.getByText(/^two merchant journeys, one recovery workflow$/i)).toBeVisible()
  await expect(page.getByText('A problem reaches each one differently. After that, the same five steps.')).toBeVisible()
})

test('both journeys are built: no "Not built yet" tag, and the brand account says once, where it matters, what is next', async ({ page }) => {
  await page.goto('/how-it-works')
  await expect(page.getByTestId('journey-flipkart')).toBeVisible()
  await expect(page.getByText(/Not built yet/)).toHaveCount(0)
  await expect(page.getByText(/next build/)).toHaveCount(2)  // the alert intake, on the Flipkart journey; and the model run, under the rules evidence
  await expect(page.getByTestId('journey-flipkart').getByText(/next build/)).toHaveCount(1)
  await expect(page.getByTestId('journey-flipkart').getByText(/made-up data/)).toBeVisible()
  await expect(page.getByTestId('journey-kaksha').getByText(/Every channel is simulated/)).toBeVisible()
  // AI is the production design: the prototype side says no model runs, and only the production side says what the model does.
  await expect(page.getByTestId('today').getByText('Rules and SQL produce every number. No AI model runs.')).toBeVisible()
  await expect(page.getByTestId('today').getByText('Both accounts run on made-up data, with known answers to check against.')).toBeVisible()
  await expect(page.getByText(/made-up merchants|Runs on the engine/)).toHaveCount(0)
  await expect(page.getByTestId('today').getByText(/AI model reads/)).toHaveCount(0)
  await expect(page.getByTestId('production').getByText(/AI model reads/)).toHaveCount(1)
})

test('each way in opens its account on Overview: the hero for both, and each journey for its own', async ({ page }) => {
  await page.goto('/how-it-works')
  await page.getByRole('button', { name: 'See it as Flipkart' }).click()
  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await expect(page.getByText(/Demo account\. Flipkart's customers/)).toBeVisible()
  await page.goto('/how-it-works')
  await page.getByRole('button', { name: 'See it as Kaksha' }).click()
  await expect(page.getByText(/Demo account\. Kaksha, its customers/)).toBeVisible()
  await page.goto('/how-it-works')
  await page.getByRole('button', { name: 'Open Flipkart’s dashboard' }).click()
  await expect(page.getByText(/Demo account\. Flipkart's customers/)).toBeVisible()
  await page.goto('/how-it-works')
  await page.getByRole('button', { name: 'Open Kaksha’s dashboard' }).click()
  await expect(page.getByText(/Demo account\. Kaksha, its customers/)).toBeVisible()
})

test('under the brand account every link stays in its own dashboard: none to Kaksha\'s issues or to Accuracy, and the shared evidence still shows', async ({ page }) => {
  await page.goto('/how-it-works?account=flipkart')
  await expect(page.getByTestId('rules-loaded')).toBeVisible()
  const hrefs = await page.getByTestId('page').locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  expect(hrefs.length, 'found the links (the crumb)').toBeGreaterThan(0)
  expect(hrefs.filter((h) => /INC-|^\/how$|^\/incidents/.test(h ?? ''))).toEqual([])
  await page.getByRole('button', { name: 'Back to Overview' }).click()
  await expect(page.getByText(/Demo account\. Flipkart's customers/)).toBeVisible()
})

test('the engine: one set of step names with the journeys, the counts in its sentence are the items drawn, and each step has its picture', async ({ page }) => {
  await page.goto('/how-it-works')
  const engine = page.getByTestId('engine')
  const ins = engine.locator('[data-testid^="engine-in-"]'), steps = engine.locator('[data-testid^="engine-step-"]'), outs = engine.locator('[data-testid^="engine-out-"]')
  await expect(ins).toHaveCount(3)
  await expect(steps).toHaveCount(4)  // steps 2 to 5; step 1, Hear, is the ways in
  await expect(outs).toHaveCount(4)
  // The page names the five steps one way: the story strip's. The engine's first band is Hear; its pictures are the other four, in order.
  await expect(engine.getByText(`1. ${STEPS[0]}: a problem comes in`)).toBeVisible()
  for (let i = 0; i < 4; i++) await expect(steps.nth(i)).toContainText(`${i + 2}. ${STEPS[i + 1]}`)
  await expect(engine.getByText(/rupee|Put a|Say whose|Win customers back/)).toHaveCount(0)
  await expect(steps.first()).toContainText('the money stuck')  // the rupee figure is part of finding everyone
  const doors = await ins.filter({ hasText: /Customer door|Alert door/ }).count()
  expect(doors).toBe(2)
  const word = ['no', 'one', 'two', 'three', 'four', 'five']
  await expect(page.getByText(new RegExp(`^${word[doors]} doors and Razorpay’s own payment records in, ${word[5]} steps, ${word[4]} places the answer lands\\.$`, 'i'))).toBeVisible()
  for (let i = 0; i < 4; i++) await expect(steps.nth(i).getByRole('img'), `step ${i + 2} has a picture with words`).toHaveAttribute('alt', /\w{4,}/)
  // No picture twice on the page (the hero's picture once stood in for a step too).
  const srcs = await page.getByTestId('page').locator('img').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).getAttribute('src')))
  expect(srcs.length, 'found the pictures').toBeGreaterThanOrEqual(7)
  expect(srcs.length - new Set(srcs).size, `a picture repeats: ${srcs.join(', ')}`).toBe(0)
})

// "Why an AI agent": the point first, every figure from the eval report, the three real misreads, what the agent does in production, and what this is not.
test('why an AI agent: the lead figure, the counts and the three misreads come from the eval report', async ({ page }) => {
  const total = metric('messy_complaints_total').value!
  const wrong = Math.round(total * (1 - metric('messy_main_claim_found').value!))
  expect(wrong, 'the report has misreads to show').toBeGreaterThan(0)
  await page.goto('/how-it-works')
  const card = page.getByTestId('rules-fail')
  await expect(card.getByRole('heading', { name: `Today’s rules misread about 1 in ${Math.round(total / wrong)} messy complaints` })).toBeVisible()
  await expect(card.getByTestId('rules-stat')).toContainText(`${wrong} of ${total}messy complaints misread`)
  // The two-problem messages are not among the misreads: read right as the main problem, with the second one missed.
  const twoN = 5, both = Math.round(metric('messy_both_issues_found').value! * twoN), main = Math.round(metric('messy_main_claim_found_two_issues').value! * twoN)
  expect(metric('messy_both_issues_found').target).toContain(`of ${twoN} two-in-one`)
  await expect(card.getByTestId('rules-stat')).toContainText(`${main - both} moreread only in part`)
  await expect(card.getByText(both === 0 ? `In each of the ${twoN} with two problems, they caught one and missed the other.` : /they caught one and missed the other/)).toBeVisible()
  await expect(card.getByText('Three the rules got wrong or half right')).toBeVisible()
  await expect(page.getByTestId('why-ai').getByText(/so an AI agent reads each message first, and the rules still produce every number\.$/)).toBeVisible()
  await expect(card.getByText(new RegExp(`tried on ${total} made-up messages`))).toBeVisible()
  const misses = card.getByTestId('rules-miss')
  await expect(misses).toHaveCount(3)
  for (const i of [1, 2, 3]) {
    const [said, read, means] = metric(`messy_miss_${i}`).target.split(' | ')
    const miss = misses.nth(i - 1)
    await expect(miss).toContainText(said.replaceAll('"', ''))
    await expect(miss, 'what the rules read, in a merchant\'s words').toContainText(`Rules read it as: ${read.replace('rules read: ', '').replace('debited no access', 'paid, no access').replace('debited no order', 'paid, no order')}`)
    await expect(miss).toContainText('The customer means:')
    expect(means).toMatch(/^it means: /)
  }
  await expect(misses.first()).toContainText('Hinglish')
  await expect(card.getByText(/made up for this test/)).toBeVisible()
  await expect(card.getByText(/No AI model has been tried on them yet/)).toBeVisible()
  await expect(card.getByText(/messy_complaints\.json/)).toHaveCount(0)  // no file path on a merchant's page
})

// Eshan: "Why is there empty space left on the right of the subheader text?" The words were capped at 720px inside a wide card. Now the words and the figures share the
// width: the figures panel ends at the card's right padding, and on a phone it sits under the words.
for (const width of [1440, 375]) {
  test(`why an AI agent has no dead band on the right at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/how-it-works')
    const card = page.getByTestId('rules-fail')
    await card.getByTestId('rules-stat').waitFor()
    await settle(page)
    const c = await box(card), stat = await box(card.getByTestId('rules-stat')), lead = await box(card.getByRole('heading', { level: 3 }))
    expect(c.x + c.width - (stat.x + stat.width), 'the figures reach the card\'s right padding').toBeLessThanOrEqual(40)
    if (width === 1440) expect(stat.x, 'beside the words').toBeGreaterThan(lead.x + lead.width - 1)
    else expect(stat.y, 'under the words').toBeGreaterThan(lead.y + lead.height)
  })
}

test('Accuracy no longer carries the rules card, and its one line leads with the figure and to the section here', async ({ page }) => {
  const total = metric('messy_complaints_total').value!, wrong = Math.round(total * (1 - metric('messy_main_claim_found').value!))
  await page.goto('/how')
  await expect(page.getByTestId('rules-moved')).toContainText(`Today’s rules misread ${wrong} of ${total} messy complaints.`)
  await expect(page.getByTestId('rules-fail')).toHaveCount(0)
  await page.getByTestId('rules-moved').getByRole('link', { name: 'Why Resolve needs an AI agent' }).click()
  await expect(page).toHaveURL(/\/how-it-works#why-ai$/)
  await expect(page.getByTestId('rules-fail')).toBeInViewport()
})

test('the way out: the menu keeps Overview marked, and the crumb and Back to Overview lead home', async ({ page }) => {
  await page.goto('/how-it-works')
  // /how is Accuracy. A menu item that matched by prefix would light up Accuracy here too.
  await expect(page.getByRole('link', { name: 'Overview' }).first()).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Accuracy' })).not.toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Back to Overview' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  await page.goBack()
  await page.getByTestId('page').getByRole('link', { name: 'Overview' }).click()  // the crumb (the menu's own item is also called Overview)
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
})

// Each part picks its layout from its own measured width (the page column is about 1072px at 1440, 912 at 1280, 656 at 1024 and 432 at 768): the hero's picture sits beside
// the words from 840px, the journeys side by side from 880px, the engine's ways in three across from 600px, its four steps across from 720px, two by two from 520px and one
// row a step below, the landing places four across from 900px.
const MODES = [[1440, true, true, 'across'], [1280, true, true, 'across'], [1024, false, false, 'pair'], [768, false, false, 'row'], [375, false, false, 'row']] as const
for (const [width, heroSide, pair, steps] of MODES) {
  test(`layout at ${width}px: hero ${heroSide ? 'side by side' : 'stacked'}, journeys ${pair ? 'paired' : 'stacked'}, engine steps ${steps}, nothing clipped or sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/how-it-works')
    await page.getByTestId('engine').waitFor()
    await settle(page)
    const heroImg = await box(page.getByTestId('hero').getByRole('img')), h1 = await box(page.getByRole('heading', { level: 1 }))
    if (heroSide) expect(h1.x, 'the words sit beside the picture').toBeGreaterThan(heroImg.x + heroImg.width - 1)
    else expect(h1.y, 'the words sit under the picture').toBeGreaterThan(heroImg.y + heroImg.height - 1)
    const k = await box(page.getByTestId('journey-kaksha')), f = await box(page.getByTestId('journey-flipkart'))
    if (pair) { expect(Math.abs(k.y - f.y), 'the journeys share a row').toBeLessThan(2); expect(Math.round(k.height), 'and one height').toBe(Math.round(f.height)) }
    else expect(f.y, 'the journeys stack').toBeGreaterThan(k.y + k.height - 1)
    const s = await Promise.all([2, 3, 4, 5].map((i) => box(page.getByTestId(`engine-step-${i}`))))
    if (steps === 'across') {
      expect(new Set(s.map((b) => Math.round(b.y))).size, 'four steps share one row').toBe(1)
      for (const b of s) expect(b.width, 'a step has room for its words').toBeGreaterThanOrEqual(150)
    } else if (steps === 'pair') {
      expect(Math.round(s[0].y), 'two by two').toBe(Math.round(s[1].y))
      expect(s[2].y, 'in two rows').toBeGreaterThan(s[0].y + s[0].height - 1)
    } else {
      for (let i = 1; i < 4; i++) expect(s[i].y, 'steps stack in order').toBeGreaterThan(s[i - 1].y + s[i - 1].height - 1)
      // One row a step: the picture on the left, its words beside it.
      const pic = await box(page.getByTestId('engine-step-2').getByRole('img')), name = await box(page.getByTestId('engine-step-2').getByText(/^2\. /))
      expect(name.x, 'the words beside the picture').toBeGreaterThan(pic.x + pic.width - 1)
    }
    // The three ways in share a row wherever the engine card has 600px (from 1024px), so no column of short lines leaves the right half empty.
    const ins = await Promise.all([1, 2, 3].map((i) => box(page.getByTestId(`engine-in-${i}`))))
    if (width >= 1024) expect(new Set(ins.map((b) => Math.round(b.y))).size, 'the ways in share a row').toBe(1)
    // No item cuts its own words off, and nothing runs sideways out of the page.
    const clipped = await page.getByTestId('page').evaluate((el) => [...el.querySelectorAll('[data-testid]')].filter((n) => /-step-\d$|^engine-(in|out)-\d$|^rules-miss$/.test(n.getAttribute('data-testid') ?? '') && n.scrollHeight > n.clientHeight + 1).map((n) => n.getAttribute('data-testid')))
    expect(clipped).toEqual([])
    const spill = await page.getByTestId('page').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(spill).toBeLessThanOrEqual(1)
  })
}

// The journeys carry no typed figure: the numbers live on the issue pages, read from the data. The only digits allowed are the step numbers.
test('the journeys carry no typed figure', async ({ page }) => {
  await page.goto('/how-it-works')
  const texts = await page.locator('[data-testid^="kaksha-step-"], [data-testid^="flipkart-step-"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/^\d\s*/, '')))
  expect(texts.length, 'found the ten steps').toBe(10)
  expect(texts.filter((t) => /\d/.test(t))).toEqual([])
})

// S2: the copy pass changed words, not sizes. The nine Explore cards were one height at 1440 and at 375px; a longer line would wrap and make them uneven.
for (const width of [1440, 375]) {
  test(`the nine Explore cards stay one height at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const cards = page.getByRole('heading', { name: 'Explore Resolve' }).locator('xpath=following-sibling::*[1]').locator('[data-blade-component="card"]')
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
    await expect(page.getByText('Resolve finds everyone a payment problem hit, says whose side it is, and wins them back.')).toBeVisible()
    await settle(page)
    const pageBox = await box(page.getByTestId('page'))
    const link = await box(page.getByRole('link', { name: 'How Resolve works' }))
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

// A section never changes size because of its data (DESIGN.md section 23 B): the report is held back, the card's loading frame is measured, then the report is let through
// and the loaded card is measured. The card, the figures panel and each example must keep their size.
for (const width of [375, 768, 1024, 1440]) {
  test(`why an AI agent keeps its size from loading to loaded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    let release!: () => void
    const held = new Promise<void>((r) => { release = r })
    await page.route('**/snapshot/eval/report.json', async (route) => { await held; await route.continue() })
    await page.goto('/how-it-works')
    await page.getByTestId('rules-loading').waitFor()
    await settle(page)
    const measure = async () => ({ card: Math.round((await box(page.getByTestId('rules-fail'))).height), stat: Math.round((await box(page.getByTestId('rules-stat'))).height), misses: await page.getByTestId('rules-miss').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height))) })
    const before = await measure()
    expect(before.misses.length, 'the loading frame draws the three examples').toBe(3)
    release()
    await page.getByTestId('rules-loaded').waitFor()
    await settle(page)
    expect(await measure()).toEqual(before)
  })
}

test('a report without the messy-complaints run leaves the whole section out', async ({ page }) => {
  await page.route('**/snapshot/eval/report.json', (route) => route.fulfill({ json: { ...report, metrics: report.metrics.filter((m) => !m.name.startsWith('messy_')) } }))
  await page.goto('/how-it-works')
  await expect(page.getByTestId('today-and-production')).toBeVisible()
  await expect(page.getByTestId('why-ai')).toHaveCount(0)
  await expect(page.getByText('Why an AI agent')).toHaveCount(0)
})
