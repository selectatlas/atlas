import { beforeEach, describe, expect, it, vi } from 'vitest'

const authGetUser = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: authGetUser },
    from: fromMock,
  }),
  createServiceClient: () => ({
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    })),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: async () => null,
}))

import { GET, PATCH } from './route'

function chain(result: { data: unknown; error?: unknown }) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    upsert: vi.fn(async () => ({ error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
  }
  return api
}

describe('/api/me/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated callers', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } })
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('returns defaults for talent', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'talent-1', email: 't@example.com' } },
    })
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return chain({ data: { account_type: 'talent', profile_visibility: 'public' } })
      }
      return chain({ data: null })
    })

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.account_type).toBe('talent')
    expect(body.notification_preferences.messages.in_app).toBe(true)
    expect(body.job_defaults).toBeUndefined()
  })

  it('rejects talent setting job defaults', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'talent-1', email: 't@example.com' } },
    })
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return chain({ data: { account_type: 'talent', profile_visibility: 'public' } })
      }
      return chain({ data: null })
    })

    const response = await PATCH(new Request('http://localhost/api/me/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        job_defaults: { category: 'dancer', location: 'London', budget: null, skills_required: [] },
      }),
    }))
    expect(response.status).toBe(400)
  })
})
