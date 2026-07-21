import { test, expect } from '@playwright/test'
import { login, seedUser, adminClient, PASSWORD } from './helpers'

test.describe('private data non-disclosure', () => {
  test('no network response ever contains another user\'s email', async ({ page }) => {
    const admin = adminClient()
    const talent = await seedUser(admin, 'talent', 'privacy-talent')
    const hirer = await seedUser(admin, 'hirer', 'privacy-hirer')

    // Give the talent some visible profile content
    await admin
      .from('profiles')
      .update({ headline: 'Bollywood dancer', city: 'London', bio: 'Award-winning dancer.' })
      .eq('id', talent.id)

    const leaks: string[] = []
    page.on('response', async response => {
      const type = response.headers()['content-type'] ?? ''
      if (!type.includes('json') && !type.includes('html')) return
      const body = await response.text().catch(() => '')
      if (body.includes(talent.email)) {
        leaks.push(`${response.status()} ${response.url()}`)
      }
    })

    await login(page, hirer.email)

    // Visit the talent's public profile page and stats endpoints
    await page.goto(`/talent/${talent.id}`)
    await page.waitForLoadState('networkidle')

    // Direct API probes with the hirer's real session
    const statsResponse = await page.request.get(`/api/talent/${talent.id}/stats`)
    expect((await statsResponse.text()).includes(talent.email)).toBe(false)

    const batchResponse = await page.request.post('/api/talent/batch-stats', {
      data: { ids: [talent.id] },
    })
    expect((await batchResponse.text()).includes(talent.email)).toBe(false)

    expect(leaks, `email leaked in: ${leaks.join(', ')}`).toHaveLength(0)
  })

  test('messages are not visible to a user who is not a participant', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'msg-hirer')
    const talent = await seedUser(admin, 'talent', 'msg-talent')
    const outsider = await seedUser(admin, 'talent', 'msg-outsider')

    // Seed a thread via service role inserts (bypasses RLS deliberately for
    // setup; the RPC-level flow is covered by the integration tests).
    const { data: thread } = await admin.from('message_threads').insert({}).select('id').single()
    await admin.from('thread_participants').insert([
      { thread_id: thread!.id, profile_id: hirer.id },
      { thread_id: thread!.id, profile_id: talent.id },
    ])
    await admin.from('messages').insert({
      thread_id: thread!.id,
      sender_id: hirer.id,
      content: 'Secret negotiation detail',
    })

    await login(page, outsider.email)
    const response = await page.request.get(`/api/messages/threads/${thread!.id}`)
    expect(response.status()).toBe(403)
    expect((await response.text()).includes('Secret negotiation detail')).toBe(false)
  })
})

test.describe('public job browsing', () => {
  test('anonymous visitors browse jobs and are routed through auth to apply', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'pub-hirer')
    const { data: job, error } = await admin
      .from('jobs')
      .insert({
        hirer_id: hirer.id,
        title: 'Public browse test role',
        description: 'A role for the public browsing e2e test',
        category: 'dancer',
        location: 'London',
        status: 'open',
      })
      .select('id, title')
      .single()
    expect(error).toBeNull()

    // The anonymous list renders without a login redirect.
    await page.goto('/jobs')
    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Creative jobs')

    // The list page is ISR-cached, so the just-seeded job may not be in it
    // yet; the detail page renders on demand and is always fresh on first hit.
    await page.goto(`/jobs/${job!.id}`)
    await expect(page.getByRole('heading', { name: job!.title })).toBeVisible()

    const cta = page.getByRole('link', { name: 'Sign up to apply' })
    await expect(cta).toBeVisible()
    await cta.click()
    await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Fjobs%2F${job!.id}`))

    // Signing in with the round-tripped next lands talent on the authed
    // detail page (proxy redirects /jobs/{id} to /discover/{id} for talent).
    const talent = await seedUser(admin, 'talent', 'pub-talent')
    await page.goto(`/login?next=/jobs/${job!.id}`)
    await page.fill('#email', talent.email)
    await page.fill('#password', PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(new RegExp(`/discover/${job!.id}`))
  })

  test('closed jobs are invisible on the public surface', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'pub-closed-hirer')
    const { data: job } = await admin
      .from('jobs')
      .insert({
        hirer_id: hirer.id,
        title: 'Closed test role',
        description: 'Should never render publicly',
        category: 'actor',
        location: 'Leeds',
        status: 'closed',
      })
      .select('id')
      .single()

    await page.goto(`/jobs/${job!.id}`)
    // Next 16 serves on-demand ISR not-found renders with a 200 status
    // (vercel/next.js#76474), so the enforceable public contract is:
    // not-found UI, a noindex directive, and zero job content leaking.
    await expect(page.getByText('Page not found')).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    expect(await page.content()).not.toContain('Should never render publicly')
  })

  test('public jobs pages are indexable while my-jobs stays noindexed', async ({ page }) => {
    const listResponse = await page.request.get('/jobs')
    expect(listResponse.status()).toBe(200)
    expect(listResponse.headers()['x-robots-tag']).toBeUndefined()

    const myJobsResponse = await page.request.get('/my-jobs', { maxRedirects: 0 })
    expect(myJobsResponse.headers()['x-robots-tag']).toContain('noindex')
  })
})
