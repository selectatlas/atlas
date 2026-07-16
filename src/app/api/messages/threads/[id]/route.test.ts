import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn() }) }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { PATCH } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const THREAD_ID = '11111111-1111-4111-8111-111111111111'

function makeClient({
  user,
  isParticipant,
  updateError,
}: {
  user: { id: string } | null
  isParticipant?: boolean
  updateError?: { code: string } | null
}) {
  const participantUpdate = vi.fn(() => ({
    eq: () => ({ eq: () => Promise.resolve({ error: updateError ?? null }) }),
  }))
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: isParticipant ? { profile_id: user?.id } : null }),
          }),
        }),
      }),
      update: participantUpdate,
    })),
    _participantUpdate: participantUpdate,
  }
}

function makeRequest(body: object | string) {
  return new Request(`http://localhost/api/messages/threads/${THREAD_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const routeParams = { params: Promise.resolve({ id: THREAD_ID }) }

describe('PATCH /api/messages/threads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 404 for a non-uuid thread id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    const res = await PATCH(makeRequest({ archived: true }), { params: Promise.resolve({ id: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }))
    const res = await PATCH(makeRequest({ archived: true }), routeParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller is not a participant', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: false }))
    const res = await PATCH(makeRequest({ archived: true }), routeParams)
    expect(res.status).toBe(403)
  })

  it('rejects a non-boolean archived value', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    const res = await PATCH(makeRequest({ archived: 'yes' }), routeParams)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, isParticipant: true }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await PATCH(makeRequest({ archived: true }), routeParams)
    expect(res.status).toBe(429)
  })

  it('archives my side of the thread', async () => {
    const client = makeClient({ user: { id: 'u1' }, isParticipant: true })
    mockCreateClient.mockResolvedValue(client)
    const res = await PATCH(makeRequest({ archived: true }), routeParams)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true, archived: true })
    expect(client._participantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ archived_at: expect.any(String) }),
    )
  })

  it('unarchives by clearing archived_at', async () => {
    const client = makeClient({ user: { id: 'u1' }, isParticipant: true })
    mockCreateClient.mockResolvedValue(client)
    const res = await PATCH(makeRequest({ archived: false }), routeParams)
    expect(res.status).toBe(200)
    expect(client._participantUpdate).toHaveBeenCalledWith({ archived_at: null })
  })

  it('returns a generic 500 when the update fails', async () => {
    const client = makeClient({ user: { id: 'u1' }, isParticipant: true, updateError: { code: 'XX000' } })
    mockCreateClient.mockResolvedValue(client)
    const res = await PATCH(makeRequest({ archived: true }), routeParams)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Failed to update thread')
  })
})
