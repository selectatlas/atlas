import { test, expect } from '@playwright/test'
import { login, seedUser, adminClient } from './helpers'

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
