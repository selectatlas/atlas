import { expect, test, type Page } from '@playwright/test'

function cssColorToRgb(color: string): [number, number, number] {
  const rgb = color.match(/rgba?\(([^)]+)\)/)
  if (rgb) {
    const values = rgb[1].split(/[ ,/]+/).slice(0, 3).map(Number)
    return [values[0], values[1], values[2]]
  }

  const lab = color.match(/lab\(([-\d.]+)%?\s+([\d.-]+)\s+([\d.-]+)/)
  if (!lab) throw new Error(`Unsupported CSS colour: ${color}`)
  const [lightness, a, b] = lab.slice(1).map(Number)
  const fy = (lightness + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const pivot = (value: number) => value ** 3 > 216 / 24389
    ? value ** 3
    : (116 * value - 16) / 903.3

  const d50x = 0.96422 * pivot(fx)
  const d50y = pivot(fy)
  const d50z = 0.82521 * pivot(fz)
  const x = 0.9555766 * d50x - 0.0230393 * d50y + 0.0631636 * d50z
  const y = -0.0282895 * d50x + 1.0099416 * d50y + 0.0210077 * d50z
  const z = 0.0122982 * d50x - 0.020483 * d50y + 1.3299098 * d50z
  const linear = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ]
  return linear.map(value => {
    const encoded = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
    return Math.max(0, Math.min(255, encoded * 255))
  }) as [number, number, number]
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = cssColorToRgb(color).map(value => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

async function gotoLanding(page: Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
}

test.describe('landing page improvements', () => {
  test('mobile header, hero, and contrast meet the phone acceptance criteria', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoLanding(page)

    await expect(page.getByRole('link', { name: 'Atlas home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Try Atlas' })).toBeVisible()
    await expect(page.locator('.landing-nav')).toBeHidden()
    await expect(page.locator('.landing-header__login')).toBeHidden()
    await expect(page.locator('.hero .ring')).toHaveCount(2)
    await expect(page.getByPlaceholder('Describe the talent you need…')).toBeVisible()

    const layout = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.landing-header')!
      const logo = document.querySelector<HTMLElement>('.landing-header .landing-brand')!
      const cta = document.querySelector<HTMLElement>('.landing-header .landing-button')!
      const firstProof = document.querySelector<HTMLElement>('.hero-proof li')!
      const headerStyle = getComputedStyle(header)
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        ctaHeight: cta.getBoundingClientRect().height,
        firstProofBottom: firstProof.getBoundingClientRect().bottom,
        headerBackground: headerStyle.backgroundColor,
        logoColor: getComputedStyle(logo).color,
        ctaBackground: getComputedStyle(cta).backgroundColor,
        ctaColor: getComputedStyle(cta).color,
      }
    })

    expect(layout.overflow).toBe(false)
    expect(layout.ctaHeight).toBeGreaterThanOrEqual(44)
    expect(layout.firstProofBottom).toBeLessThanOrEqual(844)
    expect(contrastRatio(layout.logoColor, layout.headerBackground)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(layout.ctaColor, layout.ctaBackground)).toBeGreaterThanOrEqual(4.5)
  })

  test('landing header stays usable at the 320px minimum width', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await gotoLanding(page)

    const header = page.locator('.landing-header__inner')
    await expect(page.getByRole('link', { name: 'Atlas home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Try Atlas' })).toBeVisible()
    expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await expect(page.getByRole('link', { name: 'Try Atlas' })).toHaveCSS('white-space', 'nowrap')
  })

  test('public marketplace header collapses to touch-safe mobile controls', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/jobs')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('link', { name: 'Atlas home' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Search/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
    const menu = page.getByRole('button', { name: 'Open navigation menu' })
    await expect(menu).toBeVisible()

    const sizes = await page.locator('header button, header a').evaluateAll(elements => elements
      .filter(element => getComputedStyle(element).display !== 'none')
      .map(element => element.getBoundingClientRect())
      .map(rect => ({ width: rect.width, height: rect.height })))
    expect(sizes.every(size => size.width >= 44 && size.height >= 44)).toBe(true)
    expect(await page.getByRole('banner').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)

    await menu.click()
    await expect(page.getByRole('menuitem', { name: 'Jobs' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Talent' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Sign in' })).toBeVisible()
  })

  test('anonymous hero search uses only the seeded local preview', async ({ page }) => {
    const protectedRequests: string[] = []
    page.on('request', request => {
      if (/\/api\/(search|talent)/.test(new URL(request.url()).pathname)) protectedRequests.push(request.url())
    })
    await gotoLanding(page)

    await page.getByRole('textbox', { name: 'Describe the talent you need' }).fill(
      'Bollywood dancer in London who speaks Hindi, available in December',
    )
    await page.getByRole('button', { name: 'Find talent' }).click()

    const preview = page.getByRole('region', { name: 'Demo roster search preview' })
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('From eight seeded Atlas profiles')
    await expect(preview.getByRole('heading', { name: 'Priya Singh' })).toBeVisible()
    await expect(preview).toContainText('Hindi speaker')
    await expect(preview.getByRole('link', { name: 'Search the full roster' })).toHaveAttribute(
      'href',
      /\/signup\?source=landing-preview&q=Bollywood/,
    )
    expect(protectedRequests).toEqual([])
  })

  test('carousel moves, pauses, navigates, and keeps duplicate content inaccessible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await gotoLanding(page)
    const viewport = page.locator('.landing-roster-carousel__viewport')
    await viewport.scrollIntoViewIfNeeded()
    await page.mouse.move(1, 1)

    await expect(page.locator('.landing-roster-carousel__group').first().getByRole('link')).toHaveCount(8)
    await expect(page.locator('.landing-roster-carousel__duplicate')).toHaveAttribute('aria-hidden', 'true')
    const controls = page.locator('.landing-roster-carousel__controls button')
    await expect(controls).toHaveCount(3)

    const start = await viewport.evaluate(element => element.scrollLeft)
    await page.waitForTimeout(700)
    const afterMovement = await viewport.evaluate(element => element.scrollLeft)
    expect(afterMovement).toBeGreaterThan(start)

    await page.getByRole('button', { name: 'Pause talent carousel' }).click()
    const pausedAt = await viewport.evaluate(element => element.scrollLeft)
    await page.waitForTimeout(500)
    const stillPausedAt = await viewport.evaluate(element => element.scrollLeft)
    expect(Math.abs(stillPausedAt - pausedAt)).toBeLessThan(1)

    await page.getByRole('button', { name: 'Show next talent' }).click()
    await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(stillPausedAt)

    const controlSizes = await controls.evaluateAll(elements => elements.map(element => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })))
    expect(controlSizes.every(size => size.width >= 44 && size.height >= 44)).toBe(true)
  })

  test('reduced motion replaces the moving carousel with a static grid', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoLanding(page)
    await page.getByRole('region', { name: 'Featured talent from the Atlas demo roster' }).scrollIntoViewIfNeeded()

    await expect(page.locator('.landing-roster-carousel__controls > div')).toBeHidden()
    await expect(page.locator('.landing-roster-carousel__duplicate')).toBeHidden()
    await expect(page.locator('.landing-roster-carousel__group').first().getByRole('link')).toHaveCount(8)
    await expect(page.locator('.landing-roster-carousel__group').first()).toHaveCSS('grid-template-columns', /.+/)
  })

  test('all retained landing anchors resolve', async ({ page }) => {
    await gotoLanding(page)
    for (const id of ['top', 'how-it-works', 'talent-roster', 'product', 'use-cases', 'for-hirers', 'for-talent', 'faq']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
  })
})
