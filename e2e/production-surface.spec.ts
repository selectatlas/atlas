import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { login, seedUser, adminClient, API_URL } from './helpers'

test.describe('production response surface', () => {
  test('production build was compiled against the expected Supabase stack', () => {
    const expectedHost = new URL(API_URL).hostname
    const chunksDir = join(process.cwd(), '.next/static/chunks')
    expect(existsSync(chunksDir)).toBe(true)

    const haystack = readdirSync(chunksDir)
      .filter(name => name.endsWith('.js'))
      .slice(0, 40)
      .map(name => readFileSync(join(chunksDir, name), 'utf8'))
      .join('\n')

    expect(haystack).toContain(expectedHost)
  })

  test('security headers are present on every response', async ({ request }) => {
    const response = await request.get('/login')
    const headers = response.headers()

    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    // The CSP allowlist must include the Supabase origin the app calls.
    // Resolve it the same way playwright.config.ts does: the test runner
    // gets the stack URL as API_URL, not NEXT_PUBLIC_SUPABASE_URL (which
    // only exists in the build step's env).
    const supabaseOrigin = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
        process.env.SUPABASE_TEST_URL ??
        process.env.API_URL ??
        'http://127.0.0.1:55321',
    ).origin
    expect(headers['content-security-policy']).toContain(supabaseOrigin)
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
    expect(headers['strict-transport-security']).toContain('max-age=')
  })

  test('authenticated and internal surfaces are noindex', async ({ request }) => {
    const api = await request.get('/api/health')
    expect(api.headers()['x-robots-tag']).toContain('noindex')
  })

  test('robots.txt disallows private surfaces and links the sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    const body = await response.text()
    expect(body).toContain('Disallow: /search')
    expect(body).toContain('Disallow: /settings')
    expect(body).toContain('Disallow: /messages')
    expect(body).toContain('Disallow: /design-system')
    expect(body).toContain('Sitemap:')
  })

  test('sitemap.xml lists only public pages', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')
    const body = await response.text()
    expect(body).toContain('/signup')
    expect(body).not.toContain('/search')
    expect(body).not.toContain('/messages')
  })

  test('health endpoint reports status without exposing secrets', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.database).toBe('ok')
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('sk-')
    expect(raw).not.toContain('secret')
  })

  test('unknown pages render the accessible not-found state', async ({ page }) => {
    // Unauthenticated visitors are redirected to /login by middleware, so the
    // 404 state is only reachable signed in.
    const admin = adminClient()
    const user = await seedUser(admin, 'talent', 'notfound')
    await login(page, user.email)

    const response = await page.goto('/definitely-not-a-real-page')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Atlas' })).toBeVisible()
  })
})
