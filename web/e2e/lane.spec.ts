import { expect, test, type Page } from '@playwright/test'

// The evidence lane's look (v3 batch 1.5, T5) and the live pulse on what is still happening. The lane's text and the Kaksha issues' geometry are in incident.spec.ts.

// The same geometry checks as the Kaksha issues, for the brand account's lanes, whose axis is fixed to a stretch of one evening and whose moments carry their time.
for (const id of ['FK-1', 'FK-2', 'FK-3', 'FK-4', 'FK-5', 'FK-6', 'FK-7']) {
  test(`${id}: the brand lane fits its card at every width: nothing outside, clipped or touching`, async ({ page }) => {
    for (const width of [375, 768, 1024, 1100, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/incidents/${id}?account=flipkart`)
      const lane = page.getByTestId('evidence-lane')
      await expect(lane).toBeVisible()
      await page.waitForTimeout(250)
      const m = await lane.evaluate((card) => {
        const box = card.getBoundingClientRect()
        const outside = [...card.querySelectorAll('p')].filter((p) => { const r = p.getBoundingClientRect(); return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1) }).map((p) => p.textContent)
        const clipped = [...card.querySelectorAll('[data-testid^="lane-"] p')].filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent)
        const overlap: string[] = []
        card.querySelectorAll('[data-testid^="lane-"]:not([data-testid="lane-axis"])').forEach((row) => {
          const ps = [...row.querySelectorAll('p')].slice(1).map((p) => ({ t: p.textContent, r: p.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left)
          ps.slice(1).forEach((q, i) => { if (q.r.left < ps[i].r.right - 1) overlap.push(`${ps[i].t} / ${q.t}`) })
        })
        const ticks = [...card.querySelectorAll('[data-testid="lane-axis"] p')].map((p) => p.getBoundingClientRect()).sort((a, b) => a.left - b.left)
        return { outside, clipped, overlap, gaps: ticks.slice(1).map((r, i) => Math.round(r.left - ticks[i].right)), n: ticks.length, rows: card.querySelectorAll('[data-testid^="lane-"]:not([data-testid="lane-axis"])').length }
      })
      expect(m.outside, `a label outside the card on ${id} at ${width}px`).toEqual([])
      expect(m.clipped, `a label cut short on ${id} at ${width}px`).toEqual([])
      expect(m.overlap, `labels over each other on ${id} at ${width}px`).toEqual([])
      if (m.n) {
        expect(m.rows, `rows found on ${id} at ${width}px`).toBeGreaterThanOrEqual(3)  // so the checks above cannot pass by finding nothing
        expect(m.n, `axis labels on ${id} at ${width}px`).toBeGreaterThanOrEqual(3)
        expect(Math.min(...m.gaps), `axis labels apart on ${id} at ${width}px`).toBeGreaterThanOrEqual(4)
      }
    }
  })
}

test('the line where it started runs under the dots, so it never hides the first one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const url of ['/incidents/INC-1', '/incidents/INC-4', '/incidents/FK-1?account=flipkart']) {
    await page.goto(url)
    const dots = page.getByTestId('evidence-lane').getByTestId('moment-dot')
    await expect(dots.first()).toBeVisible()
    await dots.first().scrollIntoViewIfNeeded()  // elementFromPoint sees only what is on screen
    // The first moment is the change going live, at the same time as the line. Whatever is on top at the dot's centre must be the dot.
    // The line takes no clicks, and elementFromPoint skips what takes no clicks, so it is made to take them for this one look.
    const top = await dots.first().evaluate((d) => {
      const line = d.closest('[data-testid="evidence-lane"]')!.querySelector<HTMLElement>('[data-testid="onset-line"]')!
      for (const el of [line, ...line.querySelectorAll<HTMLElement>('*')]) el.style.pointerEvents = 'auto'
      const r = d.getBoundingClientRect()
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === d
    })
    expect(top, `the first dot is on top on ${url}`).toBe(true)
  }
})

test('an issue\'s own axis reads round times, and the day is said once, in the subtitle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const id of ['INC-1', 'INC-2', 'INC-3', 'INC-4']) {
    await page.goto(`/incidents/${id}`)
    await expect(page.getByTestId('lane-axis').locator('p').first()).toBeVisible()
    const labels = await page.getByTestId('lane-axis').locator('p').allInnerTexts()
    expect(labels.length, `axis labels on ${id}`).toBeGreaterThanOrEqual(3)
    for (const l of labels) expect(l, `a round time on ${id}`).toMatch(/(^|, )\d{2}:(00|15|30|45)$|^\d{2} \w{3}$/)
  }
  await page.goto('/incidents/INC-4')  // one evening: the day once in the subtitle, the times alone on the axis
  await expect(page.getByTestId('evidence-lane').getByText('When each side saw it, Thu 01 Oct', { exact: true })).toBeVisible()
  await expect(page.getByTestId('lane-axis').getByText(/Oct/)).toHaveCount(0)
})

// Every live pulse on the page, by the area it is in.
const pulses = (page: Page) => page.evaluate(() => {
  const all = [...document.querySelectorAll('[data-testid="live-pulse"]')]
  const inArea = (id: string) => all.filter((p) => p.closest(`[data-testid="${id}"]`)).length
  return { total: all.length, strip: inArea('story-strip'), timeline: inArea('milestones'), lane: inArea('evidence-lane'), moving: document.querySelectorAll('[data-pulse="moving"]').length, still: document.querySelectorAll('[data-pulse="still"]').length }
})

test('the live pulse sits on what is happening now, one per area, and on nothing finished', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/incidents/INC-1')  // on Fix, customers still to restore, nothing open in the lane (the server answers again)
  await expect(page.getByTestId('milestones')).toBeVisible()
  expect(await pulses(page)).toMatchObject({ strip: 1, timeline: 1, lane: 0, total: 2 })
  // The pulse is on the step marked "now" and on the last timeline step, not on a done one.
  await expect(page.getByTestId('story-4').getByTestId('live-pulse')).toHaveCount(1)
  const steps = page.getByTestId('milestones').locator('[data-blade-component="step-item"]')
  await expect(steps.last().getByTestId('live-pulse')).toHaveCount(1)
  // Wrapping the marker does not move it: the live dot's centre is on the same vertical line as the dots above it.
  const centres = await page.getByTestId('milestones').evaluate((card) => [...card.querySelectorAll('svg')].filter((s) => s.closest('[data-blade-component="step-item"]') && s.getBoundingClientRect().width <= 12)
    .map((s) => { const r = s.getBoundingClientRect(); return Math.round((r.left + r.width / 2) * 2) / 2 }))
  expect(centres.length, 'timeline dots found').toBeGreaterThanOrEqual(3)
  expect(new Set(centres).size, `every timeline dot on one line: ${centres}`).toBe(1)

  await page.goto('/incidents/INC-4')  // still open: the failing stretch has no end, so its end pulses
  await expect(page.getByTestId('evidence-lane')).toBeVisible()
  await expect(page.getByTestId('lane-Your pay page').getByTestId('live-pulse')).toHaveCount(1)
  expect((await pulses(page)).lane).toBe(1)

  await page.goto('/incidents/FK-2?account=flipkart')  // closed: every step done, nothing live
  await expect(page.getByTestId('evidence-lane')).toBeVisible()
  expect((await pulses(page)).total).toBe(0)
})

test('the pulse moves, and is still for people who ask for less motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/incidents/INC-4')
  await expect(page.getByTestId('evidence-lane')).toBeVisible()
  const ring = page.getByTestId('story-strip').locator('[data-pulse]')
  await expect(ring).toHaveAttribute('data-pulse', 'moving')
  const look = () => ring.evaluate((r) => `${getComputedStyle(r).transform} ${getComputedStyle(r).opacity}`)
  const seen = new Set<string>()
  for (let i = 0; i < 6; i++) { seen.add(await look()); await page.waitForTimeout(300) }
  expect(seen.size, 'the ring changes over time').toBeGreaterThan(1)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/incidents/INC-4')
  await expect(page.getByTestId('evidence-lane')).toBeVisible()
  expect(await pulses(page)).toMatchObject({ moving: 0 })
  expect((await pulses(page)).still).toBeGreaterThanOrEqual(2)  // the strip and the open stretch keep a faint still ring, so what is live still shows
  const still = new Set<string>()
  for (let i = 0; i < 3; i++) { still.add(await page.locator('[data-pulse="still"]').first().evaluate((r) => `${getComputedStyle(r).transform} ${getComputedStyle(r).opacity}`)); await page.waitForTimeout(300) }
  expect(still.size, 'the still ring does not change').toBe(1)
})
