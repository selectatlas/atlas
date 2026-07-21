import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn() }) }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { PATCH, POST } from './route'
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

const OUTREACH_ID = '22222222-2222-4222-8222-222222222222'
const JOB_ID = '33333333-3333-4333-8333-333333333333'

function makePostClient({
  user,
  isParticipant = true,
  origin,
  originLookupThrows = false,
  quotedInThread = true,
}: {
  user: { id: string } | null
  isParticipant?: boolean
  origin?: { origin_outreach_id: string | null; origin_job_id: string | null } | null
  originLookupThrows?: boolean
  quotedInThread?: boolean
}) {
  const outreachIn = vi.fn().mockResolvedValue({ error: null })
  const outreachEqTalent = vi.fn(() => ({ in: outreachIn }))
  const outreachEqId = vi.fn(() => ({ eq: outreachEqTalent }))
  const outreachUpdate = vi.fn(() => ({ eq: outreachEqId }))
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
  const messageInsert = vi.fn(() => ({
    select: () => ({
      single: () =>
        Promise.resolve({
          data: { id: 'm1', content: 'hi', kind: 'text', sender_id: user?.id, created_at: new Date().toISOString() },
          error: null,
        }),
    }),
  }))
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
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
          insert: messageInsert,
          // reply_to_id same-thread validation lookup
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: quotedInThread ? { id: 'quoted-1' } : null }),
              }),
            }),
          }),
        }
      }
      if (table === 'message_threads') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => {
                if (originLookupThrows) return Promise.reject(new Error('boom'))
                return Promise.resolve({ data: origin ?? null })
              },
            }),
          }),
        }
      }
      return { update: outreachUpdate }
    }),
    _outreachUpdate: outreachUpdate,
    _outreachEqId: outreachEqId,
    _outreachEqTalent: outreachEqTalent,
    _messageInsert: messageInsert,
  }
}

function makePostRequest(content = 'Thanks, I would love to chat!', extra: object = {}) {
  return new Request(`http://localhost/api/messages/threads/${THREAD_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, ...extra }),
  })
}

describe('POST /api/messages/threads/[id] reply status transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('advances the linked outreach and application when replying in an origin thread', async () => {
    const client = makePostClient({
      user: { id: 'talent-1' },
      origin: { origin_outreach_id: OUTREACH_ID, origin_job_id: JOB_ID },
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest(), routeParams)
    expect(res.status).toBe(201)
    expect(client._outreachUpdate).toHaveBeenCalledWith({ status: 'responded' })
    expect(client._outreachEqId).toHaveBeenCalledWith('id', OUTREACH_ID)
    expect(client._outreachEqTalent).toHaveBeenCalledWith('talent_id', 'talent-1')
    expect(client.rpc).toHaveBeenCalledWith('mark_application_replied', { p_job_id: JOB_ID })
  })

  it('skips transitions when the thread has no origin', async () => {
    const client = makePostClient({ user: { id: 'talent-1' }, origin: { origin_outreach_id: null, origin_job_id: null } })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest(), routeParams)
    expect(res.status).toBe(201)
    expect(client._outreachUpdate).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('still returns 201 when the origin lookup fails', async () => {
    const client = makePostClient({ user: { id: 'talent-1' }, originLookupThrows: true })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest(), routeParams)
    expect(res.status).toBe(201)
  })

  it('returns 403 when the caller is not a participant', async () => {
    const client = makePostClient({ user: { id: 'talent-1' }, isParticipant: false })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest(), routeParams)
    expect(res.status).toBe(403)
  })

  it('returns 401 when unauthenticated', async () => {
    const client = makePostClient({ user: null })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest(), routeParams)
    expect(res.status).toBe(401)
  })
})

const REPLY_TO_ID = '44444444-4444-4444-8444-444444444444'

describe('POST /api/messages/threads/[id] reply_to_id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('passes a valid reply_to_id through to the insert', async () => {
    const client = makePostClient({ user: { id: 'talent-1' } })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest('Replying', { reply_to_id: REPLY_TO_ID }), routeParams)
    expect(res.status).toBe(201)
    expect(client._messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ reply_to_id: REPLY_TO_ID }),
    )
  })

  it('inserts null reply_to_id when omitted', async () => {
    const client = makePostClient({ user: { id: 'talent-1' } })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest(), routeParams)
    expect(res.status).toBe(201)
    expect(client._messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ reply_to_id: null }),
    )
  })

  it('rejects a non-uuid reply_to_id', async () => {
    const client = makePostClient({ user: { id: 'talent-1' } })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest('Replying', { reply_to_id: 'nope' }), routeParams)
    expect(res.status).toBe(400)
  })

  it('rejects a reply_to_id outside this thread', async () => {
    const client = makePostClient({ user: { id: 'talent-1' }, quotedInThread: false })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makePostRequest('Replying', { reply_to_id: REPLY_TO_ID }), routeParams)
    expect(res.status).toBe(400)
    expect(client._messageInsert).not.toHaveBeenCalled()
  })
})
