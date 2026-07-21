import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/openai', () => ({
  parseJobQuery: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/job-discovery', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/job-discovery')>()
  return { ...actual, fetchDiscoverJobs: vi.fn() }
})

import { POST } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseJobQuery } from '@/lib/openai'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { fetchDiscoverJobs } from '@/lib/job-discovery'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>
const mockParseJobQuery = parseJobQuery as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>
const mockFetchDiscoverJobs = fetchDiscoverJobs as ReturnType<typeof vi.fn>

const EMPTY_PARSE = {
  category: null, role: null, location: null, work_type: null,
  availability: null, rate_min: null, rate_max: null, keywords: [],
}

function makeClient(user: { id: string } | null, accountType: string | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: accountType ? { account_type: accountType } : null }),
        }),
      }),
    })),
  }
}

// getAuthenticatedCaller resolves the platform-admin role through the service
// client; without it every call throws before reaching the route body.
function makeServiceClient() {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
      }),
    })),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/jobs/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/jobs/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateServiceClient.mockReturnValue(makeServiceClient())
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
    mockParseJobQuery.mockResolvedValue({ ...EMPTY_PARSE })
    mockFetchDiscoverJobs.mockResolvedValue({
      ok: true,
      page: { jobs: [], nextCursor: null, total: 0 },
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await POST(makeRequest({ query: 'dance jobs in London' }))
    expect(res.status).toBe(401)
    expect(mockParseJobQuery).not.toHaveBeenCalled()
  })

  it('returns 403 for a hirer caller without spending AI quota', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    const res = await POST(makeRequest({ query: 'dance jobs in London' }))
    expect(res.status).toBe(403)
    expect(mockParseJobQuery).not.toHaveBeenCalled()
    expect(mockEnforceAiQuota).not.toHaveBeenCalled()
  })

  it('returns 403 for a suspended caller', async () => {
    const client = makeClient({ id: 'u1' }, 'talent')
    client.rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ query: 'dance jobs in London' }))
    expect(res.status).toBe(403)
    expect(mockParseJobQuery).not.toHaveBeenCalled()
  })

  it('answers the happy path with jobs, parsed intent and chips', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    mockParseJobQuery.mockResolvedValue({
      ...EMPTY_PARSE, category: 'dancer', location: 'London', rate_min: 500,
    })
    mockFetchDiscoverJobs.mockResolvedValue({
      ok: true,
      page: { jobs: [{ id: 'j1', title: 'Backing dancer' }], nextCursor: null, total: 1 },
    })

    const res = await POST(makeRequest({ query: 'dance jobs in London over £500 a day' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobs).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.parsed.location).toBe('London')
    expect(body.chips).toContain('London')
    expect(body.fellBackToKeyword).toBe(false)
  })

  it('maps the parsed intent onto the discover filters it queries with', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    mockParseJobQuery.mockResolvedValue({
      ...EMPTY_PARSE, category: 'dancer', role: 'backing dancer',
      location: 'London', work_type: 'in_person', rate_min: 500,
    })

    await POST(makeRequest({ query: 'in person backing dancer jobs in London over 500' }))

    const filters = mockFetchDiscoverJobs.mock.calls[0][1]
    expect(filters.categories).toEqual(['dancer'])
    // Location rides in the full-text term, not the exact-match filter.
    expect(filters.search).toBe('backing dancer London')
    expect(filters.location).toBeNull()
    expect(filters.workType).toBe('in_person')
    expect(filters.budgetBand).toBe('over500')
  })

  it('falls back to plain keyword search when the parse is empty', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    mockParseJobQuery.mockResolvedValue({ ...EMPTY_PARSE })

    const res = await POST(makeRequest({ query: 'zzzq unparseable' }))
    const body = await res.json()

    expect(body.fellBackToKeyword).toBe(true)
    const filters = mockFetchDiscoverJobs.mock.calls[0][1]
    expect(filters.search).toContain('zzzq')
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
  })

  it('returns 400 for a missing or oversized query', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    expect((await POST(makeRequest({}))).status).toBe(400)
    expect((await POST(makeRequest({ query: 'x'.repeat(501) }))).status).toBe(400)
    expect(mockParseJobQuery).not.toHaveBeenCalled()
  })

  it('returns 429 before any OpenAI spend when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ query: 'dance jobs' }))
    expect(res.status).toBe(429)
    expect(mockParseJobQuery).not.toHaveBeenCalled()
  })

  it('returns 429 before any OpenAI spend when the AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Daily limit reached' }, { status: 429 }))
    const res = await POST(makeRequest({ query: 'dance jobs' }))
    expect(res.status).toBe(429)
    expect(mockParseJobQuery).not.toHaveBeenCalled()
  })

  it('returns 503 without leaking the upstream error when OpenAI fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    mockParseJobQuery.mockRejectedValue(new Error('openai exploded: key sk-secret'))
    const res = await POST(makeRequest({ query: 'dance jobs' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('sk-secret')
  })

  it('returns 500 with a generic message when the query fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    mockFetchDiscoverJobs.mockResolvedValue({ ok: false })
    const res = await POST(makeRequest({ query: 'dance jobs' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Jobs could not be loaded')
  })
})
