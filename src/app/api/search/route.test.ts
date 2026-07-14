import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/openai', () => ({
  parseSearchQuery: vi.fn().mockResolvedValue({ category: null, skills: [], location: null, availability: null, languages: [] }),
  embedText: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseSearchQuery, embedText } from '@/lib/openai'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>
const mockParseSearchQuery = parseSearchQuery as ReturnType<typeof vi.fn>
const mockEmbedText = embedText as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

function makeClient(user: { id: string } | null, accountType: string | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: accountType ? { account_type: accountType } : null }),
        }),
      }),
    })),
  }
}

function makeServiceClient() {
  return {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => ({
      select: () => ({
        in: () => ({
          eq: () => Promise.resolve({ data: [] }),
        }),
      }),
    })),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
    mockParseSearchQuery.mockResolvedValue({ category: null, skills: [], location: null, availability: null, languages: [] })
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0))
    mockCreateServiceClient.mockReturnValue(makeServiceClient())
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a talent caller without calling OpenAI', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(403)
    expect(mockParseSearchQuery).not.toHaveBeenCalled()
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    const res = await POST(makeRequest('{broken'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a missing or oversized query', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    expect((await POST(makeRequest({}))).status).toBe(400)
    expect((await POST(makeRequest({ query: 'x'.repeat(501) }))).status).toBe(400)
  })

  it('returns 429 before any OpenAI spend when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(429)
    expect(mockParseSearchQuery).not.toHaveBeenCalled()
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('returns 429 before any OpenAI spend when the daily AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(429)
    expect(mockParseSearchQuery).not.toHaveBeenCalled()
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('returns 503 (not a crash) when OpenAI fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockEmbedText.mockRejectedValue(new Error('upstream timeout'))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(503)
  })

  it('returns results for a valid hirer search', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.results).toEqual([])
  })
})
