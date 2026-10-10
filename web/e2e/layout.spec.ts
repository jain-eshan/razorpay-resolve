import { expect, test } from '@playwright/test'

// Layout guard: every screen at phone, tablet and desktop width must render without errors, and its content must not spill sideways.
// Tables scroll inside their own box and carousels slide, so they are not counted. A failure means a fixed width or an unwrapped row (web/DESIGN.md section 19).
// One test per screen: it loads the screen once, then resizes through the three widths. A slow runner fails one screen, not all of them.
const ROUTES = ['/', '/guides/blindspot', '/guides/incidents', '/guides/conversations', '/guides/channels', '/guides/scan', '/guides/autonomy', '/guides/learning', '/guides/how', '/setup', '/incidents', '/incidents/INC-1', '/incidents/INC-2', '/incidents/INC-3', '/incidents/INC-4', '/incidents/INC-5', '/incidents/INC-1/dev', '/threads', '/channels', '/scan', '/access', '/release-check', '/connect', '/audit', '/how', '/learning', '/settings', '/chat-demo', '/help-demo/receipt', '/email-demo', '/ig-demo', '/public-demo', '/cases/first']
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
    await expect(page.locator('#root'), 'the page must not be hidden from assistive technology at phone width').not.toHaveAttribute('aria-hidden', 'true')
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

// Phone width also has to work for assistive technology and the keyboard. Blade's mobile SideNav keeps a hidden drawer mounted, and the focus manager inside it marks the whole page aria-hidden, so every button and link disappears from screen readers and from getByRole.
test('phone: a closed menu leaves the page readable to assistive technology', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/channels')
  await page.getByTestId('page').waitFor()
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('#root')).not.toHaveAttribute('data-floating-ui-inert')
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'How it works' })).toBeVisible()
})

test('phone: widening the window past the phone layout closes the open menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/channels')
  await page.getByTestId('page').waitFor()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('dialog', { name: 'Main menu' })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true')
})

test('phone: the open menu is reachable, traps focus and hides the page, closing it gives the page back', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/channels')
  await page.getByTestId('page').waitFor()
  await page.getByRole('button', { name: 'Open menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Main menu' })
  await expect(menu).toBeVisible()
  await expect(page.locator('#root')).toHaveAttribute('aria-hidden', 'true')
  await expect(menu.getByRole('link', { name: 'Channels' })).toBeVisible()
  await expect(menu.getByText('Transactions')).toBeVisible() // production items stay in the menu, greyed and not links
  await expect(menu.getByRole('link', { name: 'Transactions' })).toHaveCount(0)
  const focusInMenu = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
  expect(await focusInMenu(), 'focus starts in the menu').toBe(true)
  for (let i = 0; i < 14; i++) await page.keyboard.press('Tab') // more presses than the menu has stops, so focus has to wrap
  await expect.poll(focusInMenu, { message: 'Tab cannot leave the menu' }).toBe(true)
  for (let i = 0; i < 14; i++) await page.keyboard.press('Shift+Tab')
  await expect.poll(focusInMenu, { message: 'Shift+Tab cannot leave the menu' }).toBe(true)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByRole('button', { name: 'How it works' })).toBeVisible()
})

// Blade's mobile SideNav once kept a drawer mounted while closed, which set aria-hidden on the whole page. Loaded straight at phone width, role queries found nothing.
// This test loads at 375px (not resized from desktop) and looks a button up by role, then checks the menu drawer still opens, navigates and closes.
// The open menu has its own test above; this one only walks the menu once, end to end, from a page loaded at phone width.
test('phone width: page is exposed to assistive technology and the menu works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/incidents/INC-1')
  await expect(page.getByRole('button', { name: 'Test hook' })).toBeVisible()
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog', { name: 'Main menu' }).getByRole('link', { name: 'Conversations' }).click()
  await expect(page).toHaveURL(/\/threads$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true')
})
