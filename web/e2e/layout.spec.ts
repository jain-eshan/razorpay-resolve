import { expect, test } from '@playwright/test'

// Layout guard: every screen at phone, tablet and desktop width must render without errors, and its content must not spill sideways.
// Tables scroll inside their own box, so they are not counted. A failure here means a fixed width or an unwrapped row (web/DESIGN.md section 19).
const ROUTES = ['/', '/guides/blindspot', '/setup', '/incidents', '/incidents/INC-1', '/incidents/INC-4', '/incidents/INC-5', '/incidents/INC-1/dev', '/threads', '/channels', '/scan', '/audit', '/how', '/settings', '/chat-demo', '/help-demo/receipt', '/email-demo']
const WIDTHS = [375, 768, 1440]

for (const width of WIDTHS) {
  test(`layout holds at ${width}px on every screen`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    const spill: string[] = []
    for (const route of ROUTES) {
      await page.goto(route)
      await page.getByTestId('page').waitFor()
      await page.waitForLoadState('networkidle')
      const over = await page.getByTestId('page').evaluate((el) => {
        const box = el.getBoundingClientRect()
        const tooWide = [...el.querySelectorAll('*')].filter((n) => {
          if (n.closest('[data-blade-component="table"], table, [data-blade-component="carousel"]')) return false
          const r = n.getBoundingClientRect()
          return r.width > 0 && r.right > box.right + 1
        })
        return { page: el.scrollWidth - el.clientWidth, first: tooWide.slice(0, 3).map((n) => `${n.tagName}.${n.getAttribute('data-blade-component') ?? ''}${n.getAttribute('data-testid') ? '#' + n.getAttribute('data-testid') : ''} ${Math.round(n.getBoundingClientRect().width)}w`).join(' > '), n: tooWide.length }
      })
      if (over.page > 1 || over.n > 0) spill.push(`${route}: page +${over.page}px, ${over.n} element(s) past the edge (${over.first})`)
    }
    expect(errors, 'page errors').toEqual([])
    expect(spill, 'content spills sideways').toEqual([])
  })
}
