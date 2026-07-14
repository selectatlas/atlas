import { test, expect } from '@playwright/test'
import { signupViaUi, login, seedUser, adminClient, PASSWORD } from './helpers'

test.describe('authentication journeys', () => {
  test('talent can sign up and lands on discover', async ({ page }) => {
    await signupViaUi(page, 'talent', 'signup-talent')
    await page.waitForURL(/\/discover/)
    await expect(page).toHaveURL(/\/discover/)
  })

  test('hirer can sign up and lands on search', async ({ page }) => {
    await signupViaUi(page, 'hirer', 'signup-hirer')
    await page.waitForURL(/\/search/)
    await expect(page).toHaveURL(/\/search/)
  })

  test('login rejects a wrong password without leaking detail', async ({ page }) => {
    const admin = adminClient()
    const user = await seedUser(admin, 'talent', 'wrong-pass')

    await page.goto('/login')
    await page.fill('#email', user.email)
    await page.fill('#password', 'not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login and sign out round trip', async ({ page }) => {
    const admin = adminClient()
    const user = await seedUser(admin, 'talent', 'roundtrip')

    await login(page, user.email)
    await expect(page).toHaveURL(/\/discover/)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL(/\/login/)

    // Session is really gone: an authenticated page redirects to login
    await page.goto('/messages')
    await page.waitForURL(/\/login/)
  })

  test('password login works after signup (session persistence)', async ({ page, context }) => {
    const admin = adminClient()
    const user = await seedUser(admin, 'hirer', 'persist')
    await login(page, user.email)

    // A fresh tab in the same context stays authenticated
    const secondTab = await context.newPage()
    await secondTab.goto('/jobs')
    await expect(secondTab).toHaveURL(/\/jobs/)
    void PASSWORD
  })
})
