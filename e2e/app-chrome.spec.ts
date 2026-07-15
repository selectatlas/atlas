import { test, expect } from '@playwright/test'
import { login, seedUser, adminClient } from './helpers'

test.describe('app chrome', () => {
  test('hirer jobs page shows breadcrumbs and page title', async ({ page }) => {
    const admin = adminClient()
    const user = await seedUser(admin, 'hirer', 'chrome-hirer')
    await login(page, user.email)

    await page.goto('/jobs')
    await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText('My jobs')
    await expect(page.getByRole('heading', { name: 'My jobs', level: 1 })).toBeVisible()
  })

  test('command palette opens with keyboard shortcut', async ({ page }) => {
    const admin = adminClient()
    const user = await seedUser(admin, 'hirer', 'chrome-cmdk')
    await login(page, user.email)

    await page.goto('/home')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyK' : 'Control+KeyK')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByPlaceholder('Search pages or talent…')).toBeVisible()
  })

  test('notifications page loads for signed-in user', async ({ page }) => {
    const admin = adminClient()
    const user = await seedUser(admin, 'talent', 'chrome-notifs')
    await login(page, user.email)

    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible()
  })
})
