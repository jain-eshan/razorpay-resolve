import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// The issue page (v3 batch 1.2): the story strip, the three numbers, "Is it just you?", root cause and actions, the charts. "Where rules fail" moved to How Resolve works (e2e/how-it-works.spec.ts).
// Each figure is checked against the same files the page reads, so a number typed into a screen would fail here.
const file = <T,>(p: string): T => JSON.parse(readFileSync(`public/snapshot/${p}.json`, 'utf8'))
type Inc = { id: string; affected: number; complained: number; silent: number; fixed: number; at_risk_paise: number; status: string; mismatch_type: string; lift: unknown[]; title: string; tier_counts: { exact: number; likely?: number; check?: number } }
const incs = [1, 2, 3, 4, 5].map((i) => file<Inc>(`incidents/INC-${i}`))
const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)

test('the story strip tells the five steps with the issue\'s own numbers, and marks the one it is on', async ({ page }) => {
  const inc = incs[0]
  await page.goto('/incidents/INC-1')
  const strip = page.getByTestId('story-strip')
  await expect(strip.getByTestId('story-1')).toContainText(`${inc.complained} wrote in`)
  await expect(strip.getByTestId('story-2')).toContainText(`${inc.affected} customers hit`)
  await expect(strip.getByTestId('story-2')).toContainText('not only those who wrote in')  // the 68 silent are in the numbers below, not repeated here
  await expect(strip.getByTestId('story-3')).toContainText('Your code')
  const waiting = (inc.tier_counts?.exact ?? 0) + (inc.tier_counts?.likely ?? 0) + (inc.tier_counts?.check ?? 0)
  await expect(strip.getByTestId('story-4')).toContainText(`0 of ${waiting} put right`)  // nothing approved yet, so nothing is put right by Resolve
  await expect(strip.getByTestId('story-5')).toContainText('No one told yet')
  await expect(strip.getByText('Fix · now')).toBeVisible()  // steps 1 to 3 are done, so it is on the fourth
  await expect(strip.getByText(/· now$/)).toHaveCount(1)
})

// PRD v3: Resolve never claims a customer who sorted it out without it. "Put right" counts only what its approved actions did, out of the customers it can act for; the rest
// (fixed by you, paid on their own, not reachable yet) are said beside it, and everything adds up to the customers hit. The counts come from the same files the page reads.
type Member = { exclusion_reason: string | null; tier: string }
for (const inc of incs) {
  test(`${inc.id}: the Fix tile counts only what Resolve put right, and says who sorted it out on their own`, async ({ page }) => {
    const members = file<Member[]>(`incidents/${inc.id}/members`)
    const own = members.filter((m) => /^Paid since\b/.test(m.exclusion_reason ?? '')).length
    const you = members.filter((m) => m.exclusion_reason === 'already active (manual grant)' || m.exclusion_reason === 'refunded').length
    await page.goto(`/incidents/${inc.id}`)
    const fix = page.getByTestId('story-4')
    await fix.waitFor()
    const waiting = (inc.tier_counts?.exact ?? 0) + (inc.tier_counts?.likely ?? 0) + (inc.tier_counts?.check ?? 0)
    const unreachable = inc.affected - waiting - own - you
    await expect(fix).toContainText(`0 of ${waiting} put right`)
    if (own) await expect(fix).toContainText(`${own} paid on their own`)
    if (you) await expect(fix).toContainText(`${you} fixed by you`)
    if (unreachable > 0) await expect(fix).toContainText(`${unreachable} can't be reached yet`)
    // The tile and its note account for every customer hit, and "still to put right" below says the same waiting count.
    const said = (await fix.innerText()).match(/\d+(?= (fixed by you|paid on their own|can't be reached yet))/g)?.map(Number) ?? []
    expect(waiting + said.reduce((a, n) => a + n, 0), `${inc.id}: the Fix tile adds up to the customers hit`).toBe(inc.affected)
    await expect(page.getByTestId('incident-stats')).toContainText(`${waiting} still to put right`)
    if (inc.id !== 'INC-2') expect(own + you, `${inc.id} has someone to say beside the count, so this test checks something`).toBeGreaterThan(0)
  })
}

// "What Resolve cannot see" is said once on every issue page: one label, then the caveats as a list, not the label in front of each caveat.
type Caveats = { verdict: { what_we_cannot_see: string[] } }
for (const inc of incs) {
  test(`${inc.id}: "What Resolve cannot see" appears once, with every caveat listed under it`, async ({ page }) => {
    const caveats = file<Caveats>(`incidents/${inc.id}`).verdict.what_we_cannot_see
    await page.goto(`/incidents/${inc.id}`)
    await page.getByTestId('just-you').waitFor()  // the page has loaded, so a count of 0 or 2 below is real
    await expect(page.getByTestId('cannot-see')).toHaveCount(1)
    await expect(page.getByText(/What Resolve cannot see/)).toHaveCount(1)
    expect(caveats.length).toBeGreaterThan(0)
    for (const c of caveats) await expect(page.getByTestId('cannot-see').getByText(c, { exact: true })).toBeVisible()
  })
}

// One way to send the issue to the developer per page (it lives in the actions card), and no engine customer id (cust_...) anywhere a merchant reads.
for (const inc of incs) {
  test(`${inc.id}: one "Send to your developer" on the page, and no raw customer id`, async ({ page }) => {
    await page.goto(`/incidents/${inc.id}`)
    await page.getByTestId('fix-panel').waitFor()  // the whole page is in, fix steps included
    const dev = page.locator('main').getByRole('button', { name: /Send to your developer|Open the evidence (pack|page)/ }).or(page.locator('main').getByRole('link', { name: /page for your developer/ }))
    await expect(dev).toHaveCount(1)
    await expect(page.getByTestId('root-cause-actions').getByRole('button', { name: /Send to your developer|Open the evidence pack/ })).toHaveCount(1)
    expect(await page.locator('main').innerText()).not.toMatch(/\bcust_\w+/)
  })
}

for (const inc of incs) {
  test(`${inc.id}: the three numbers at the top equal the data`, async ({ page }) => {
    await page.goto(`/incidents/${inc.id}`)
    const stats = page.getByTestId('incident-stats')
    const value = (label: string) => stats.getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]')
    await expect(value('Customers hit')).toHaveText(String(inc.affected))
    await expect(value('Money stuck')).toHaveText(rupees(inc.at_risk_paise))
    await expect(value('Never wrote in')).toHaveText(String(inc.silent))
    await expect(stats.getByText(`${inc.tier_counts.exact} still to put right`)).toBeVisible()
  })
}

test('"Is it just you?" says it in plain sentences, strongest first, with the numbers behind a tap, and says when there is nothing to compare', async ({ page }) => {
  await page.goto('/incidents/INC-1')
  const panel = page.getByTestId('just-you')
  await expect(panel.getByText('All affected payments had a webhook that failed or was never attempted, against 0% normally.')).toBeVisible()
  await expect(panel.getByText(/^60% of affected payments came from web-2\.8\.0, against 0% normally\.$/)).toBeVisible()
  await expect(panel.getByText(/Other merchants are not compared yet/)).toBeVisible()  // what is not built is said, in the panel's own subtitle
  await expect(panel.getByRole('progressbar')).toHaveCount(0)  // the bars are behind "Show the numbers"
  await panel.getByText(/Show the numbers \(\d+ patterns checked\)/).click()
  expect(await panel.getByRole('progressbar').count()).toBeGreaterThan(2)
  await page.goto('/incidents/INC-4')  // a pay-page issue has no payments to compare
  await expect(page.getByTestId('just-you').getByText(/no payments to compare/)).toBeVisible()
  await page.goto('/incidents/INC-2')
  await expect(page.getByTestId('just-you').getByText(/^All affected payments came from android-3\.4\.1, against 0% normally\.$/)).toBeVisible()
})

test('root cause and actions: the cause, the fix and whose side from the data; Razorpay-side issues say what to do', async ({ page }) => {
  const pack = file<{ suggested_fix: string }>('incidents/INC-1/evidence_pack')
  await page.goto('/incidents/INC-1')
  const card = page.getByTestId('root-cause-actions')
  await expect(card.getByText(pack.suggested_fix)).toBeVisible()
  await expect(card.getByText('Your code', { exact: true })).toBeVisible()
  await expect(card.getByText(`Give ${incs[0].tier_counts.exact} customers their access back, in steps`)).toBeVisible()
  await page.goto('/incidents/INC-2')  // refunds go one customer at a time: the card does not promise a "first 5" step
  await expect(page.getByTestId('root-cause-actions').getByText(/one customer at a time, and you approve each one/)).toBeVisible()
  await expect(page.getByTestId('root-cause-actions').getByText('Release android-3.4.1')).toBeVisible()  // not the engine's "app_release android-3.4.1"
  await page.goto('/incidents/INC-3')  // Razorpay's side: nothing for the merchant to change
  await expect(page.getByTestId('root-cause-actions').getByText('What to do', { exact: true })).toBeVisible()
  await expect(page.getByTestId('root-cause-actions').getByRole('button', { name: 'Open the evidence pack' })).toBeVisible()
  await expect(page.getByTestId('just-you').getByText(/failed with a gateway error/)).toBeVisible()  // not the code GATEWAY_ERROR
})

for (const inc of incs) {
  test(`${inc.id}: one blue button outside the fix steps (each step in the fix flow is its own decision)`, async ({ page }) => {
    await page.goto(`/incidents/${inc.id}`)
    await expect(page.getByTestId('root-cause-actions')).toBeVisible()
    // Blade's primary blue is about rgb(19, 100, 241). Count any button outside the fix steps whose fill is that blue.
    const blue = await page.evaluate(() => [...document.querySelectorAll('main button')].filter((b) => !b.closest('[data-testid="fix-steps"]') && b.getBoundingClientRect().width > 0).map((b) => ({ name: b.textContent, bg: getComputedStyle(b).backgroundColor })).filter((b) => { const m = b.bg.match(/\d+/g)?.map(Number) ?? []; return m.length >= 3 && m[2] > 200 && m[0] < 80 && m[1] < 140 }))
    expect(blue.map((b) => b.name), 'the page\'s one blue button').toEqual(['Start the fix'])
  })
}

test('a finished or missing issue: nothing waiting says so; a dead address says so and gives the way out', async ({ page }) => {
  await page.route('**/snapshot/incidents/INC-1.json', async (route) => {
    const body = await (await route.fetch()).json()
    await route.fulfill({ json: { ...body, tier_counts: { ...body.tier_counts, exact: 0 } } })
  })
  await page.goto('/incidents/INC-1')
  await expect(page.getByTestId('root-cause-actions').getByText('Nothing is waiting for you. Every step has been approved.')).toBeVisible()
  await expect(page.getByTestId('root-cause-actions').getByRole('button', { name: 'See how it was fixed' })).toBeVisible()
  await page.goto('/incidents/INC-99')
  await expect(page.getByText('We could not find that payment issue')).toBeVisible()
  await expect(page.getByText(/Unexpected token/)).toHaveCount(0)
  await page.getByRole('button', { name: 'See all payment issues' }).click()
  await expect(page).toHaveURL(/\/incidents$/)
})

// Each chart's first mark, named for what happened (not "Started").
const START: Record<string, string> = { 'INC-1': 'Webhooks broke', 'INC-2': 'App released', 'INC-3': 'Cards failing', 'INC-4': 'Pay page broke' }
const CHARTS: [string, string, string][] = [['INC-1', 'timeline-chart', 'Webhooks per hour'], ['INC-2', 'duplicate-chart', 'Orders per day'], ['INC-3', 'renewal-chart', 'Card renewals per hour'], ['INC-4', 'orders-chart', 'Orders per hour']]
for (const [id, tid, unit] of CHARTS) {
  test(`${id}: the chart has its unit on the axis, at most four gridlines, the start marked, and its key inside the card at every width`, async ({ page }) => {
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/incidents/${id}`)
      const chart = page.getByTestId(tid)
      await expect(chart.getByText(unit)).toBeVisible()
      await page.waitForTimeout(900)  // the bars finish drawing
      expect(await chart.locator('.recharts-cartesian-grid-horizontal line').count(), `gridlines at ${width}px`).toBeLessThanOrEqual(4)
      expect(await chart.locator('.recharts-reference-line').count(), 'a line where it started').toBeGreaterThanOrEqual(1)
      const m = await page.evaluate((t) => {
        const c = document.querySelector(`[data-testid="${t}"]`)!, key = c.parentElement!.querySelector('[data-testid="chart-legend"]')!, card = c.closest('[data-blade-component="card"]')!
        return { chartBottom: c.getBoundingClientRect().bottom, keyTop: key.getBoundingClientRect().top, keyBottom: key.getBoundingClientRect().bottom, cardBottom: card.getBoundingClientRect().bottom, items: key.querySelectorAll('span').length }
      }, tid)
      expect(m.items).toBeGreaterThanOrEqual(2)
      // A label on a line, an axis label and a value tick must be readable: inside the plot, not touching their neighbours, and in equal steps.
      const axes = await chart.evaluate((el) => {
        const rect = (n: Element) => n.getBoundingClientRect()
        const svg = el.querySelector('svg.recharts-surface')!.getBoundingClientRect()
        // The label's pill (the rect behind its text) must end inside the plot's own svg, or its border is cut.
        const marks = [...el.querySelectorAll('.recharts-reference-line')].filter((l) => l.textContent).map((l) => ({ t: l.textContent, r: rect(l.querySelector('rect')!).right, box: svg.right }))
        // Blade draws a pill on every reference line, even one with no text: a line on the chart must always carry its name.
        const empty = [...el.querySelectorAll('.recharts-reference-line')].filter((l) => !(l.textContent ?? '').trim()).length
        const x = [...el.querySelectorAll('text')].filter((n) => n.getAttribute('text-anchor') !== 'end' && /\d/.test(n.textContent ?? '')).map(rect).sort((a, b) => a.left - b.left)  // the date labels under the bars
        const y = [...el.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((n) => Number((n.textContent ?? '').replace(/[^\d.]/g, '')))
        return { marks, empty, xGaps: x.slice(1).map((r, i) => Math.round(r.left - x[i].right)), y }
      })
      expect(axes.empty, `a line with an empty label pill at ${width}px`).toBe(0)
      // A mark with no room is not drawn; the key says what it was and when (INC-1's fix is too near the right edge).
      if (id === 'INC-1') await expect(page.getByTestId('chart-legend')).toContainText('Also happened, but too close to mark: Webhooks fixed (Thu 01 Oct, 11:34)')
      expect(axes.marks.map((mk) => mk.t), `the start is marked by name at ${width}px`).toContain(START[id])
      for (const mk of axes.marks) expect(mk.r, `the label "${mk.t}" inside the chart at ${width}px`).toBeLessThanOrEqual(mk.box)
      expect(axes.y.length, `value ticks found at ${width}px`).toBeGreaterThanOrEqual(3)  // so these checks cannot pass by finding nothing
      expect(axes.xGaps.length, `axis labels found at ${width}px`).toBeGreaterThanOrEqual(1)
      if (axes.xGaps.length) expect(Math.min(...axes.xGaps), `axis labels apart at ${width}px: ${axes.xGaps}`).toBeGreaterThanOrEqual(4)
      const ys = axes.y.filter((v) => !Number.isNaN(v))
      if (ys.length > 2) expect(new Set(ys.slice(1).map((v, i) => v - ys[i])).size, `value ticks in equal steps at ${width}px: ${ys}`).toBe(1)
      expect(m.keyTop, `the key is below the chart at ${width}px`).toBeGreaterThanOrEqual(m.chartBottom)
      expect(m.keyBottom, `the key is inside its card at ${width}px`).toBeLessThanOrEqual(m.cardBottom)
    }
  })
}

const WATCH = ['story-strip', 'incident-stats', 'evidence-lane', 'just-you', 'root-cause-actions']
for (const inc of incs) {
  test(`${inc.id}: nothing on the page changes size as it loads, even when one file is slow`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    // The local files arrive in a blink, which hides a card that grows when its data comes late. Delay the evidence pack, as a slow network would.
    await page.route('**/evidence_pack.json', async (route) => { await new Promise((r) => setTimeout(r, 600)); await route.continue() })
    await page.addInitScript((ids) => {
      const seen: Record<string, string[]> = {}
      ;(window as unknown as { __seen: typeof seen }).__seen = seen
      const tick = () => {
        for (const id of ids) {
          const el = document.querySelector(`[data-testid="${id}"]`)
          if (!el) continue
          const r = el.getBoundingClientRect(), now = `${Math.round(r.width)}x${Math.round(r.height)}`
          const list = (seen[id] ??= [])
          if (list[list.length - 1] !== now) list.push(now)
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, WATCH)
    await page.goto(`/incidents/${inc.id}`)
    await expect(page.getByTestId('root-cause-actions').getByText('The fix', { exact: true }).or(page.getByTestId('root-cause-actions').getByText('What to do', { exact: true }))).toBeVisible()
    await page.waitForTimeout(1500)
    const seen = await page.evaluate(() => (window as unknown as { __seen: Record<string, string[]> }).__seen)
    for (const id of WATCH) expect(seen[id], `${id} keeps one size from its first frame on ${inc.id}`).toHaveLength(1)
  })
}

for (const width of [375, 768, 1200]) {
test(`the story strip keeps its height, and its numbers move, as the fix goes from waiting to done at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })  // 1200 is five narrow tiles, where a longer note wraps to a second line
  const btn = (name: string | RegExp) => page.getByRole('button', { name }).first()
  const strip = page.getByTestId('story-strip')
  // Each tile's own text column, not the strip: the strip is as tall as its tallest tile and would hide a tile that grew inside it.
  const heights: string[] = []
  const note = async () => { heights.push((await strip.evaluate((el) => [1, 2, 3, 4, 5].map((n) => Math.round(el.querySelector(`[data-testid="story-${n}"]`)!.lastElementChild!.getBoundingClientRect().height)).join('/')))) }
  await page.goto('/incidents/INC-1')
  await expect(strip).toBeVisible()
  await note()
  await btn('Run the check').click()
  await btn('Plan the fix').click()
  await btn('Looks right, continue').click()
  const before = await page.getByTestId('story-4').innerText()  // "0 of 81 put right" (81 waiting; the 4 you fixed are in the note)
  await btn('Grant the first 5').click()
  await expect(page.getByText(/^5 of \d+ confirmed active by your records/)).toBeVisible()
  await expect.poll(() => page.getByTestId('story-4').innerText(), 'the first 5 count once confirmed').toContain('5 of 81 put right')
  await note()
  await btn(/^Grant the rest/).click()
  await expect(page.getByText(/^\d+ of \d+ confirmed active/).first()).toBeVisible()
  // 81 given access back by Resolve; the other 4 the merchant had already handled, so they are said beside the count, not in it.
  await expect.poll(() => page.getByTestId('story-4').innerText(), 'the number in the strip moves with the fix').toContain('81 of 81 put right')
  await expect(page.getByTestId('story-4')).toContainText('4 fixed by you')
  expect(before).toContain('0 of 81 put right')
  await note()
  await btn('Preview the message').click()
  await btn('Switch messaging on').click()
  await btn('Looks right, continue').click()
  await btn('Grant the first 5').click()
  await btn(/^Grant the rest/).click()
  await expect(page.getByText('Undo these changes')).toHaveCount(0)  // customers were told
  await note()
  await btn('Check it held and close').click()
  await btn('Your developer ships the fix').click()
  await btn('Check it held and close').click()
  await btn('Move the clock forward 24 hours').click()
  await btn('Check it held and close').click()
  await expect(page.getByTestId('success-moment')).toBeVisible()
  await expect(strip.getByText(/· now$/)).toHaveCount(0)  // closed and the customers told: every step is done
  await note()
  expect(new Set(heights).size, `every tile's text keeps its height from waiting to closed: ${heights.join(' then ')}`).toBe(1)
})
}

for (const inc of incs) {
test(`${inc.id}: the lane and its axis fit inside the card at every width: nothing outside, clipped or touching`, async ({ page }) => {  // one test per issue: the runner is slow and a single test for all five hit the 60 second limit
  for (const width of [375, 768, 1024, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    {
      await page.goto(`/incidents/${inc.id}`)
      const lane = page.getByTestId('evidence-lane')
      await expect(lane).toBeVisible()
      await page.waitForTimeout(250)
      const m = await lane.evaluate((card) => {
        const box = card.getBoundingClientRect()
        const outside = [...card.querySelectorAll('p')].filter((p) => { const r = p.getBoundingClientRect(); return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1) }).map((p) => p.textContent)
        // A label cut short by its own box (ellipsis) or drawn over a neighbour in its row.
        const clipped = [...card.querySelectorAll('[data-testid^="lane-"] p')].filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent)
        const overlap: string[] = []
        card.querySelectorAll('[data-testid^="lane-"]:not([data-testid="lane-axis"])').forEach((row) => {
          const ps = [...row.querySelectorAll('p')].slice(1).map((p) => ({ t: p.textContent, r: p.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left)  // the first p is the row's name
          ps.slice(1).forEach((q, i) => { if (q.r.left < ps[i].r.right - 1) overlap.push(`${ps[i].t} / ${q.t}`) })
        })
        const ticks = [...card.querySelectorAll('[data-testid="lane-axis"] p')].map((p) => p.getBoundingClientRect()).sort((a, b) => a.left - b.left)
        return { outside, clipped, overlap, gaps: ticks.slice(1).map((r, i) => Math.round(r.left - ticks[i].right)), n: ticks.length }
      })
      expect(m.outside, `a label outside the card on ${inc.id} at ${width}px`).toEqual([])
      expect(m.clipped, `a label cut short on ${inc.id} at ${width}px`).toEqual([])
      expect(m.overlap, `labels over each other on ${inc.id} at ${width}px`).toEqual([])
      if (m.n) {  // the time axis; below about 520px of card the lane is a list and has none
        expect([3, 4], `axis labels on ${inc.id} at ${width}px`).toContain(m.n)
        expect(Math.min(...m.gaps), `axis labels apart on ${inc.id} at ${width}px`).toBeGreaterThanOrEqual(4)
      }
    }
  }
})
}

// Accuracy read as a wall of bold (Eshan, 13 Oct). Only the figures are bold: a stat's label is regular, and so is a check's name in the full table.
test('Accuracy: stat labels are regular weight and only the figures are bold', async ({ page }) => {
  await page.goto('/how')
  const weight = (l: import('@playwright/test').Locator) => l.evaluate((el) => Number(getComputedStyle(el).fontWeight))
  const label = page.getByText('Stuck customers the first check found', { exact: true })
  expect(await weight(label)).toBeLessThan(500)
  expect(await weight(label.locator('xpath=following-sibling::*[1]'))).toBeGreaterThanOrEqual(600)
  await page.getByRole('button', { name: /^Show all \d+ checks$/ }).click()
  expect(await weight(page.getByText('First check customers found vs truth', { exact: true }))).toBeLessThan(500)
})

test('the evidence lane puts each side on one row: whose side shows before anyone reads the text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/incidents/INC-1')  // your change, your server failing, Razorpay fine, Resolve's alert
  const lane = page.getByTestId('evidence-lane')
  for (const row of ['Your side', 'Your server', 'Razorpay', 'Resolve']) await expect(lane.getByTestId(`lane-${row}`)).toBeVisible()
  await expect(lane.getByTestId('lane-Your server')).toContainText('answered 401')
  await expect(lane.getByTestId('lane-Razorpay')).toContainText('payments captured normally')
  await expect(lane.getByTestId('lane-Resolve')).toContainText('Resolve would have alerted')
  await page.goto('/incidents/INC-3')  // Razorpay's side: no row for your side, because nothing changed there
  await expect(page.getByTestId('evidence-lane').getByTestId('lane-Your side')).toHaveCount(0)
  await expect(page.getByTestId('evidence-lane').getByTestId('lane-Razorpay')).toContainText('gateway errors on cards')
  await page.goto('/incidents/INC-4')  // still open: the failing stretch runs to the end of the axis and says so, not a lone dot
  await expect(page.getByTestId('lane-Your pay page')).toContainText('failing, still open')
  await expect(page.getByTestId('lane-Your side')).toContainText('Change went live')
  await page.setViewportSize({ width: 375, height: 800 })  // a phone gets a list, not a squeezed axis
  await page.goto('/incidents/INC-1')
  await expect(page.getByTestId('evidence-lane').getByText(/^answered 401 · /)).toBeVisible()
  await expect(page.getByTestId('lane-Your server')).toHaveCount(0)
})
