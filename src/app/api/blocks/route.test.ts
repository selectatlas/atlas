import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { GET, POST, DELETE } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'

function makeClient({
  user,
  targetExists = true,
  insertError = null,
}: {
  user: { id: string } | null
  targetExists?: boolean
  insertError?: { code: string } | null
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: targetExists ? { id: TARGET_ID } : null }) }),
          }),
        }
      }
      // blocks
      return {
        select: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: [{ blocked_id: TARGET_ID, created_at: 'now' }] }) }),
        }),
        insert: vi.fn().mockResolvedValue({ error: insertError }),
        delete: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
      }
    }),
  }
}

function makeRequest(method: string, body: object | string) {
  return new Request('http://localhost/api/blocks', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('/api/blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('GET returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }))
    expect((await GET()).status).toBe(401)
  })

  it('GET lists own blocks', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: USER_ID } }))
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.blocks).toHaveLength(1)
  })

  it('POST returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }))
    expect((await POST(makeRequest('POST', { blocked_id: TARGET_ID }))).status).toBe(401)
  })

  it('POST rejects malformed JSON, bad ids, and self-blocking', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: USER_ID } }))
    expect((await POST(makeRequest('POST', '{broken'))).status).toBe(400)
    expect((await POST(makeRequest('POST', { blocked_id: 'nope' }))).status).toBe(400)
    expect((await POST(makeRequest('POST', { blocked_id: USER_ID }))).status).toBe(400)
  })

  it('POST returns 404 for a nonexistent target', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: USER_ID }, targetExists: false }))
    expect((await POST(makeRequest('POST', { blocked_id: TARGET_ID }))).status).toBe(404)
  })

  it('POST blocks a user, and repeat blocks stay idempotent', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: USER_ID } }))
    const first = await POST(makeRequest('POST', { blocked_id: TARGET_ID }))
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toEqual({ blocked: true })

    mockCreateClient.mockResolvedValue(makeClient({ user: { id: USER_ID }, insertError: { code: '23505' } }))
    const second = await POST(makeRequest('POST', { blocked_id: TARGET_ID }))
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({ blocked: true })
  })

  it('POST returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: USER_ID } }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    expect((await POST(makeRequest('POST', { blocked_id: TARGET_ID }))).status).toBe(429)
  })

  it('DELETE unblocks', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: USER_ID } }))
    const res = await DELETE(makeRequest('DELETE', { blocked_id: TARGET_ID }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ blocked: false })
  })
})
