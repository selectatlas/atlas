import { test, expect } from '@playwright/test'
import { login, seedUser, adminClient } from './helpers'

test.describe('messaging center', () => {
  test('outreach starts a conversation the hirer can continue in the inbox', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'inbox-hirer')
    const talent = await seedUser(admin, 'talent', 'inbox-talent')

    await login(page, hirer.email)

    // Send outreach through the API with the hirer's real session - this is
    // the origin-aware thread creation path.
    const outreachResponse = await page.request.post('/api/outreach', {
      data: { talent_id: talent.id, action: 'send', message: 'Hello from outreach!' },
    })
    expect(outreachResponse.status()).toBe(200)
    const { thread_id } = (await outreachResponse.json()) as { thread_id: string }
    expect(thread_id).toBeTruthy()

    // The unified inbox lists the conversation with the outreach as its
    // first message.
    await page.goto('/messages')
    const listItem = page.getByRole('link', { name: /E2E inbox-talent/ })
    await expect(listItem).toBeVisible()
    await expect(listItem).toContainText('Hello from outreach!')

    // Open the thread and send a follow-up through the composer.
    await listItem.click()
    await page.waitForURL(`/messages/${thread_id}`)
    await expect(page.getByText('Hello from outreach!')).toBeVisible()

    await page.getByRole('textbox', { name: 'Message' }).fill('Following up - are you free next week?')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('Following up - are you free next week?')).toBeVisible()

    // The thread records the outreach as its origin.
    const { data: thread } = await admin
      .from('message_threads')
      .select('origin_outreach_id')
      .eq('id', thread_id)
      .single()
    expect(thread?.origin_outreach_id).toBeTruthy()
  })

  test('read receipts show Seen once the other participant opens the thread', async ({ browser, page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'seen-hirer')
    const talent = await seedUser(admin, 'talent', 'seen-talent')

    await login(page, hirer.email)
    const outreachResponse = await page.request.post('/api/outreach', {
      data: { talent_id: talent.id, action: 'send', message: 'Can you make the shoot?' },
    })
    const { thread_id } = (await outreachResponse.json()) as { thread_id: string }

    // The talent opens the thread in a separate session, which marks it read.
    const talentContext = await browser.newContext()
    const talentPage = await talentContext.newPage()
    await login(talentPage, talent.email)
    const readResponse = await talentPage.request.get(`/api/messages/threads/${thread_id}`)
    expect(readResponse.status()).toBe(200)
    await talentContext.close()

    // The hirer's view now shows Seen under their last message.
    await page.goto(`/messages/${thread_id}`)
    await expect(page.getByText('Can you make the shoot?', { exact: true })).toBeVisible()
    await expect(page.getByText('Seen', { exact: true })).toBeVisible()
  })

  test('a hirer can start a conversation from the message center', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'compose-hirer')
    const talent = await seedUser(admin, 'talent', 'compose-talent')

    await login(page, hirer.email)
    await page.goto('/messages')

    await page.getByRole('button', { name: 'New message' }).click()
    await page.getByLabel('Search talent', { exact: true }).fill('E2E compose-talent')
    await page.getByRole('button', { name: /E2E compose-talent/ }).click()

    // Lands in the (newly created) thread with a working composer.
    await page.waitForURL(/\/messages\/[0-9a-f-]{36}/)
    await page.getByRole('textbox', { name: 'Message' }).fill('Hi! Found you through search.')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('Hi! Found you through search.')).toBeVisible()

    // The talent is a participant of the created thread.
    const threadId = page.url().split('/').pop()!
    const { data: participants } = await admin
      .from('thread_participants')
      .select('profile_id')
      .eq('thread_id', threadId)
    expect(participants?.map(p => p.profile_id).sort()).toEqual([hirer.id, talent.id].sort())
  })

  test('replying quotes the original message', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'reply-hirer')
    const talent = await seedUser(admin, 'talent', 'reply-talent')

    await login(page, hirer.email)
    const outreachResponse = await page.request.post('/api/outreach', {
      data: { talent_id: talent.id, action: 'send', message: 'Are you free for a shoot in May?' },
    })
    const { thread_id } = (await outreachResponse.json()) as { thread_id: string }

    await page.goto(`/messages/${thread_id}`)
    await expect(page.getByText('Are you free for a shoot in May?', { exact: true })).toBeVisible()

    // Open the message actions menu (hover-revealed) and start a reply.
    await page.getByText('Are you free for a shoot in May?', { exact: true }).hover()
    await page.getByRole('button', { name: 'Message actions' }).click()
    await page.getByRole('button', { name: 'Reply' }).click()

    // Composer shows the quote strip; send the reply.
    await expect(page.getByText(/Replying to/)).toBeVisible()
    await page.getByRole('textbox', { name: 'Message' }).fill('Yes - May works for me.')
    await page.getByRole('button', { name: 'Send message' }).click()

    // The sent bubble renders with the quoted original above it.
    await expect(page.getByText('Yes - May works for me.')).toBeVisible()
    const { data: reply } = await admin
      .from('messages')
      .select('reply_to_id')
      .eq('thread_id', thread_id)
      .eq('content', 'Yes - May works for me.')
      .single()
    expect(reply?.reply_to_id).toBeTruthy()
  })

  test('reactions appear live for the other participant', async ({ browser, page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'react-hirer')
    const talent = await seedUser(admin, 'talent', 'react-talent')

    await login(page, hirer.email)
    const outreachResponse = await page.request.post('/api/outreach', {
      data: { talent_id: talent.id, action: 'send', message: 'Sending over the brief now' },
    })
    const { thread_id } = (await outreachResponse.json()) as { thread_id: string }
    await page.goto(`/messages/${thread_id}`)
    await expect(page.getByText('Sending over the brief now', { exact: true })).toBeVisible()

    // The talent reacts in a second session.
    const talentContext = await browser.newContext()
    const talentPage = await talentContext.newPage()
    await login(talentPage, talent.email)
    await talentPage.goto(`/messages/${thread_id}`)
    await talentPage.getByText('Sending over the brief now').hover()
    await talentPage.getByRole('button', { name: 'Message actions' }).click()
    await talentPage.getByRole('button', { name: 'React with 👍' }).click()
    await expect(talentPage.getByRole('button', { name: /👍/ })).toBeVisible()

    // The hirer sees the pill arrive live via the thread channel broadcast.
    await expect(page.getByRole('button', { name: /👍/ })).toBeVisible()
    await talentContext.close()
  })

  test('broadcast messages every shortlisted talent', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'cast-hirer')
    const talentA = await seedUser(admin, 'talent', 'cast-talent-a')
    const talentB = await seedUser(admin, 'talent', 'cast-talent-b')

    await admin.from('shortlists').insert([
      { hirer_id: hirer.id, talent_id: talentA.id },
      { hirer_id: hirer.id, talent_id: talentB.id },
    ])

    await login(page, hirer.email)
    await page.goto('/shortlists')
    await page.getByRole('button', { name: /Message all \(2\)/ }).click()
    await page
      .getByRole('textbox', { name: 'Broadcast message' })
      .fill('Casting call: new campaign next month!')
    await page.getByRole('button', { name: /Send to 2 people/ }).click()

    // Lands in messages with both new conversations present.
    await page.waitForURL('/messages')
    await expect(page.getByRole('link', { name: /E2E cast-talent-a/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /E2E cast-talent-b/ })).toBeVisible()

    // Both talents got the same message in their own 1:1 thread.
    const { data: sent } = await admin
      .from('messages')
      .select('id, thread_id')
      .eq('content', 'Casting call: new campaign next month!')
    expect(sent?.length).toBe(2)
    expect(new Set(sent?.map(m => m.thread_id)).size).toBe(2)
  })

  test('archiving moves a conversation to the Archived tab', async ({ page }) => {
    const admin = adminClient()
    const hirer = await seedUser(admin, 'hirer', 'archive-hirer')
    const talent = await seedUser(admin, 'talent', 'archive-talent')

    await login(page, hirer.email)
    const outreachResponse = await page.request.post('/api/outreach', {
      data: { talent_id: talent.id, action: 'send', message: 'Archive me later' },
    })
    const { thread_id } = (await outreachResponse.json()) as { thread_id: string }

    await page.goto(`/messages/${thread_id}`)
    await page.getByRole('button', { name: 'Conversation actions' }).click()
    // Archiving is optimistic with an async PATCH; navigating before the
    // response lands cancels the request and nothing persists.
    const archivePersisted = page.waitForResponse(
      response => response.url().includes(`/api/messages/threads/${thread_id}`) && response.request().method() === 'PATCH',
    )
    await page.getByRole('menuitem', { name: 'Archive conversation' }).click()
    await archivePersisted

    // Gone from Open, present under Archived.
    await page.goto('/messages')
    await expect(page.getByRole('link', { name: /E2E archive-talent/ })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Archived' }).click()
    await expect(page.getByRole('link', { name: /E2E archive-talent/ })).toBeVisible()
  })
})
