import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const TALENT_ID = '11111111-1111-4111-8111-111111111111'

function makeClient(user: { id: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: () => ({ in: () => Promise.resolve({ data: [{ talent_id: TALENT_ID }] }) }),
    })),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/talent/batch-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/talent/batch-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    const res = await POST(makeRequest({ ids: [TALENT_ID] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await POST(makeRequest('{broken'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for more than 50 ids or non-uuid ids', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }))
    expect((await POST(makeRequest({ ids: Array(51).fill(TALENT_ID) }))).status).toBe(400)
    expect((await POST(makeRequest({ ids: ['talent-1'] }))).status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ ids: [TALENT_ID] }))
    expect(res.status).toBe(429)
  })

  it('returns aggregated stats for valid ids', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await POST(makeRequest({ ids: [TALENT_ID] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stats[TALENT_ID]).toEqual({ views: 1, likes: 1 })
  })
})
