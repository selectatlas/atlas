import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  // Used by getPlatformAdminRole: not a platform admin.
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    })),
  })),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { GET, POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const SAVED_ROW = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Bollywood dancers',
  query: 'Bollywood dancers in London',
  filters: { category: 'dancer' },
  last_viewed_at: '2026-07-01T00:00:00.000Z',
  created_at: '2026-06-01T00:00:00.000Z',
}

function makeClient({
  user,
  accountType,
  existingCount = 0,
  insertError = null,
}: {
  user: { id: string } | null
  accountType: string | null
  existingCount?: number
  insertError?: { code: string } | null
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: accountType ? { account_type: accountType } : null }),
            }),
          }),
        }
      }
      // saved_searches
      return {
        select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) {
            return { eq: () => Promise.resolve({ count: existingCount }) }
          }
          return {
            eq: () => ({
              order: () => Promise.resolve({ data: [SAVED_ROW] }),
            }),
          }
        },
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve(insertError ? { data: null, error: insertError } : { data: SAVED_ROW, error: null }),
          }),
        }),
      }
    }),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/saved-searches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID_BODY = { name: 'Bollywood dancers', query: 'Bollywood dancers in London', filters: { category: 'dancer' } }

describe('GET /api/saved-searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null, accountType: null }))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as talent (cross-role)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent' }))
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('lists the caller saved searches', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.savedSearches).toHaveLength(1)
    expect(data.savedSearches[0]).toMatchObject({
      id: SAVED_ROW.id,
      name: SAVED_ROW.name,
      query: SAVED_ROW.query,
      filters: { category: 'dancer' },
    })
  })
})

describe('POST /api/saved-searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null, accountType: null }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as talent (cross-role)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent' }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 400 for malformed JSON and invalid payloads', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
    expect((await POST(makeRequest({ query: 'dancers' }))).status).toBe(400)
    expect((await POST(makeRequest({ name: 'Empty search' }))).status).toBe(400)
    expect((await POST(makeRequest({ name: 'Bad filters', filters: { bogus: true } }))).status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
  })

  it('returns 400 when the saved-search limit is reached', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', existingCount: 20 }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
  })

  it('creates a saved search as hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.savedSearch).toMatchObject({ name: SAVED_ROW.name, query: SAVED_ROW.query })
  })

  it('returns 500 when the insert fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', insertError: { code: '23514' } }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
  })
})
