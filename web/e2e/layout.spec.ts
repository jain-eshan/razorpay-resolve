import { expect, test } from '@playwright/test'

// Layout guard: every screen at phone, tablet and desktop width must render without errors, and its content must not spill sideways.
// Tables scroll inside their own box and carousels slide, so they are not counted. A failure means a fixed width or an unwrapped row (web/DESIGN.md section 19).
// One test per screen: it loads the screen once, then resizes through the three widths. A slow runner fails one screen, not all of them.
const ROUTES = ['/', '/guides/blindspot', '/setup', '/incidents', '/incidents/INC-1', '/incidents/INC-4', '/incidents/INC-5', '/incidents/INC-1/dev', '/threads', '/channels', '/scan', '/audit', '/how', '/learning', '/settings', '/chat-demo', '/help-demo/receipt', '/email-demo', '/ig-demo', '/public-demo', '/cases/first']
const WIDTHS = [375, 768, 1440]

for (const route of ROUTES) {
  test(`layout ${route}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width: WIDTHS[0], height: 900 })
    let path = route
    if (route === '/cases/first') path = `/cases/${(await (await page.request.get('/snapshot/cases.json')).json())[0].id}`
    await page.goto(path)
    await page.getByTestId('page').waitFor()
    await page.waitForLoadState('networkidle')
    const spills: string[] = []
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))) // let the layout settle after the resize
      const over = await page.getByTestId('page').evaluate((el) => {
        const box = el.getBoundingClientRect()
        const tooWide = [...el.querySelectorAll('*')].filter((n) => {
          if (n.closest('[data-blade-component="table"], table, [data-blade-component="carousel"]')) return false
          const r = n.getBoundingClientRect()
          return r.width > 0 && r.right > box.right + 1
        })
        return { page: el.scrollWidth - el.clientWidth, n: tooWide.length, first: tooWide.slice(0, 3).map((n) => `${n.tagName}.${n.getAttribute('data-blade-component') ?? ''} ${Math.round(n.getBoundingClientRect().width)}w`).join(' > ') }
      })
      if (over.page > 1 || over.n > 0) spills.push(`${width}px: page +${over.page}px, ${over.n} element(s) past the edge (${over.first})`)
    }
    expect(errors, 'page errors').toEqual([])
    expect(spills, `content spills sideways on ${route}`).toEqual([])
  })
}
