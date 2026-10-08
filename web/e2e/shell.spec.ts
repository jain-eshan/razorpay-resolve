import { expect, test } from '@playwright/test'

// The top bar must look like the dashboard's: the real blue and white logo, and everything on the bar's centre line at every width (it was 8px low on a phone).
// Also: code comments must never show as page text (one did, in the welcome card).
for (const width of [375, 768, 1440]) {
  test(`top bar is centred and shows the Razorpay logo at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.getByTestId('page').waitFor()
    await expect(page.locator('[data-blade-component="top-nav"] img[src="/razorpay-logo.svg"]')).toBeVisible()
    const off = await page.evaluate(() => {
      const bar = document.querySelector('[data-blade-component="top-nav"]')!
      const mid = bar.getBoundingClientRect().top + bar.getBoundingClientRect().height / 2
      return [...bar.querySelectorAll('button[aria-label="Open menu"], img, [data-blade-component="avatar"], [data-blade-component="tab-nav-item"], input')]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => ({ what: e.getAttribute('data-blade-component') ?? e.tagName, off: Math.abs(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2 - mid) }))
        .filter((x) => x.off > 1)
    })
    expect(off, 'top bar items off the centre line by more than 1px').toEqual([])
  })
}

for (const route of ['/', '/guides/blindspot', '/setup']) {
  test(`no code comment shows as text on ${route}`, async ({ page }) => {
    await page.goto(route)
    await page.getByTestId('page').waitFor()
    await expect(page.getByTestId('page')).not.toContainText(/\/\/ |\{\/\*/)
  })
}
