import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn() }) }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const THREAD_ID = '11111111-1111-4111-8111-111111111111'
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222'

function makeClient({
  user,
  isParticipant = true,
  messageInThread = true,
  writeError = null,
}: {
  user: { id: string } | null
  isParticipant?: boolean
  messageInThread?: boolean
  writeError?: { code: string } | null
}) {
  const upsert = vi.fn().mockResolvedValue({ error: writeError })
  const deleteEqProfile = vi.fn().mockResolvedValue({ error: writeError })
  const deleteEqMessage = vi.fn(() => ({ eq: deleteEqProfile }))
  const deleteFn = vi.fn(() => ({ eq: deleteEqMessage }))
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'thread_participants') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: isParticipant ? { profile_id: user?.id } : null }),
              }),
            }),
          }),
        }
      }
      if (table === 'messages') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: messageInThread ? { id: MESSAGE_ID } : null }),
              }),
            }),
          }),
        }
      }
      // message_reactions
      return { upsert, delete: deleteFn }
    }),
    _upsert: upsert,
    _delete: deleteFn,
  }
}

function makeRequest(body: object) {
  return new Request(`http://localhost/api/messages/threads/${THREAD_ID}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const routeParams = { params: Promise.resolve({ id: THREAD_ID }) }

describe('POST /api/messages/threads/[id]/reactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }))
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '👍' }), routeParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller is not a participant', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: false }))
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '👍' }), routeParams)
    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-uuid thread id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' } }))
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '👍' }), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })

  it('rejects an unsupported emoji', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' } }))
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '🔥' }), routeParams)
    expect(res.status).toBe(400)
  })

  it('rejects a non-uuid message id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' } }))
    const res = await POST(makeRequest({ message_id: 'nope', emoji: '👍' }), routeParams)
    expect(res.status).toBe(400)
  })

  it('rejects a message that is not in this thread', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, messageInThread: false }))
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '👍' }), routeParams)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' } }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '👍' }), routeParams)
    expect(res.status).toBe(429)
  })

  it('upserts a reaction', async () => {
    const client = makeClient({ user: { id: 'u1' } })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '❤️' }), routeParams)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ message_id: MESSAGE_ID, emoji: '❤️' })
    expect(client._upsert).toHaveBeenCalledWith(
      { message_id: MESSAGE_ID, profile_id: 'u1', emoji: '❤️' },
      { onConflict: 'message_id,profile_id' },
    )
    expect(client._delete).not.toHaveBeenCalled()
  })

  it('removes a reaction on null emoji', async () => {
    const client = makeClient({ user: { id: 'u1' } })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: null }), routeParams)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ message_id: MESSAGE_ID, emoji: null })
    expect(client._delete).toHaveBeenCalled()
    expect(client._upsert).not.toHaveBeenCalled()
  })

  it('returns a generic 500 when the write fails', async () => {
    const client = makeClient({ user: { id: 'u1' }, writeError: { code: 'XX000' } })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ message_id: MESSAGE_ID, emoji: '👍' }), routeParams)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Failed to update reaction')
  })
})
