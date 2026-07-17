import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
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

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const TALENT_ID = '22222222-2222-4222-8222-222222222222'

function makeClient({
  user,
  accountType,
  hiredCount = 1,
  existingReviews = 0,
  insertError = null,
}: {
  user: { id: string } | null
  accountType: string | null
  hiredCount?: number
  existingReviews?: number
  insertError?: { code: string } | null
}) {
  const insert = vi.fn(() => ({
    select: () => ({
      single: () => Promise.resolve(
        insertError ? { data: null, error: insertError } : { data: { id: 'review-1' }, error: null },
      ),
    }),
  }))

  return {
    insert,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    // is_caller_suspended check in getAuthenticatedCaller
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
      if (table === 'applications') {
        // Head count of hired applications with this talent.
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ count: hiredCount }),
              }),
            }),
          }),
        }
      }
      // talent_reviews: head count of the hirer's existing reviews + insert.
      return {
        insert,
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ count: existingReviews }),
          }),
        }),
      }
    }),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID_BODY = {
  talent_id: TALENT_ID,
  rating: 5,
  recommend_score: 9,
  body: 'Fantastic collaborator, delivered ahead of schedule.',
  rating_communication: 5,
  rating_reliability: 4,
  rating_craft: 5,
}

describe('POST /api/reviews', () => {
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

  it('returns 403 when the caller is suspended', async () => {
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer' })
    client.rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Account suspended')
  })

  it('returns 403 (never 404) when the hirer has no hired application with the talent', async () => {
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer', hiredCount: 0 })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    expect(client.insert).not.toHaveBeenCalled()
  })

  it('returns 409 when every hired booking already has a review (no rating stacking)', async () => {
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer', hiredCount: 1, existingReviews: 1 })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
    expect(client.insert).not.toHaveBeenCalled()
  })

  it('allows another review after a repeat hire', async () => {
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer', hiredCount: 2, existingReviews: 1 })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    expect(client.insert).toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON and invalid fields', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
    expect((await POST(makeRequest({ ...VALID_BODY, talent_id: 'not-a-uuid' }))).status).toBe(400)
    expect((await POST(makeRequest({ ...VALID_BODY, rating: 6 }))).status).toBe(400)
    expect((await POST(makeRequest({ ...VALID_BODY, recommend_score: 11 }))).status).toBe(400)
    expect((await POST(makeRequest({ ...VALID_BODY, rating_craft: 0 }))).status).toBe(400)
    expect((await POST(makeRequest({ ...VALID_BODY, body: '' }))).status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
  })

  it('publishes a review for a hired talent (happy path)', async () => {
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer' })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ id: 'review-1' })
    expect(client.insert).toHaveBeenCalledWith({
      talent_id: TALENT_ID,
      reviewer_id: 'u1',
      rating: 5,
      body: VALID_BODY.body,
      project_title: null,
      recommend_score: 9,
      rating_communication: 5,
      rating_reliability: 4,
      rating_craft: 5,
    })
  })

  it('accepts a review without sub-ratings', async () => {
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer' })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({
      talent_id: TALENT_ID,
      rating: 4,
      recommend_score: 7,
      body: 'Great work on the campaign.',
    }))
    expect(res.status).toBe(201)
    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({
      rating_communication: null,
      rating_reliability: null,
      rating_craft: null,
    }))
  })

  it('returns 500 when the insert fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      user: { id: 'u1' }, accountType: 'hirer', insertError: { code: '23514' },
    }))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
  })
})
