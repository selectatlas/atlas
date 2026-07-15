import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const USER_ID = '11111111-1111-4111-8111-111111111111'

function chainResolving(data: unknown) {
  // Supports .select().eq()/.or() chains ending in awaited results or maybeSingle()
  const result = Promise.resolve({ data })
  return {
    select: () => ({
      eq: () => Object.assign(result, { maybeSingle: () => Promise.resolve({ data }) }),
      or: () => result,
    }),
  }
}

function makeClient(user: { id: string; email?: string; created_at?: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') return chainResolving({ id: USER_ID, full_name: 'Test User' })
      return chainResolving([])
    }),
  }
}

describe('GET /api/account/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    expect((await GET()).status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    expect((await GET()).status).toBe(429)
  })

  it('returns a downloadable JSON export of the caller\'s own data', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ id: USER_ID, email: 'me@example.test', created_at: '2026-01-01' }),
    )
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('cache-control')).toBe('no-store')

    const data = await res.json()
    expect(data.account.id).toBe(USER_ID)
    expect(data.account.email).toBe('me@example.test')
    expect(data.profile.full_name).toBe('Test User')
    expect(data.messages_sent).toEqual([])
    expect(data.reports_filed).toEqual([])
  })
})
