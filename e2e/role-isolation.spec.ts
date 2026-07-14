import { test, expect } from '@playwright/test'
import { login, seedUser, adminClient } from './helpers'

test.describe('role and session isolation', () => {
  test('unauthenticated visitors are redirected to login', async ({ page }) => {
    for (const path of ['/messages', '/search', '/discover', '/jobs', '/activity']) {
      await page.goto(path)
      await page.waitForURL(/\/login/)
    }
  })

  test('unauthenticated API calls are rejected', async ({ request }) => {
    const search = await request.post('/api/search', { data: { query: 'dancers' } })
    expect(search.status()).toBe(401)

    const outreach = await request.post('/api/outreach', {
      data: { talent_id: '11111111-1111-4111-8111-111111111111', action: 'generate' },
    })
    expect(outreach.status()).toBe(401)

    const stats = await request.post('/api/talent/batch-stats', {
      data: { ids: ['11111111-1111-4111-8111-111111111111'] },
    })
    expect(stats.status()).toBe(401)
  })

  test('talent cannot reach hirer surfaces', async ({ page }) => {
    const admin = adminClient()
    const talent = await seedUser(admin, 'talent', 'isolation-talent')
    await login(page, talent.email)

    for (const path of ['/search', '/jobs', '/outreach']) {
      await page.goto(path)
      await page.waitForURL(/\/discover/)
    }

    // API-level enforcement, not just redirects: same session, direct call
    const response = await page.request.post('/api/search', { data: { query: 'dancers' } })
    expect(response.status()).toBe(403)
  })

  test('hirer cannot reach talent surfaces', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'isolation-hirer')
    await login(page, hirer.email)

    for (const path of ['/discover', '/profile']) {
      await page.goto(path)
      await page.waitForURL(/\/search/)
    }

    // A hirer cannot apply to jobs through the API either
    const response = await page.request.post('/api/applications', {
      data: { job_id: '11111111-1111-4111-8111-111111111111' },
    })
    expect(response.status()).toBe(403)
  })

  test('malformed and abusive API payloads fail safely', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'abuse-hirer')
    await login(page, hirer.email)

    // Malformed JSON -> 400, not a 500 crash
    const malformed = await page.request.post('/api/shortlist', {
      headers: { 'content-type': 'application/json' },
      data: '{broken json',
    })
    expect(malformed.status()).toBe(400)

    // Oversized payload -> 413
    const oversized = await page.request.post('/api/search', {
      data: { query: 'x'.repeat(200_000) },
    })
    expect(oversized.status()).toBe(413)

    // Non-UUID resource id -> 400
    const badId = await page.request.post('/api/shortlist', {
      data: { talent_id: 'not-a-uuid' },
    })
    expect(badId.status()).toBe(400)
  })
})
