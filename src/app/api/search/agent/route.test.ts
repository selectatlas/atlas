import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/agent-search', () => ({
  runAgentSearch: vi.fn().mockResolvedValue({ summary: '', results: [], searches: 0 }),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { runAgentSearch } from '@/lib/agent-search'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockRunAgentSearch = runAgentSearch as ReturnType<typeof vi.fn>
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

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/search/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function readEvents(res: Response) {
  const text = await res.text()
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line))
}

describe('POST /api/search/agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
    mockRunAgentSearch.mockResolvedValue({ summary: '', results: [], searches: 0 })
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(401)
    expect(mockRunAgentSearch).not.toHaveBeenCalled()
  })

  it('returns 403 for a talent caller without running the agent', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(403)
    expect(mockRunAgentSearch).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON and missing or oversized queries', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
    expect((await POST(makeRequest({}))).status).toBe(400)
    expect((await POST(makeRequest({ query: 'x'.repeat(501) }))).status).toBe(400)
  })

  it('rejects unknown structured filters before spending', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    const res = await POST(makeRequest({ query: 'actors', filters: { private_admin_flag: true } }))
    expect(res.status).toBe(400)
    expect(mockRunAgentSearch).not.toHaveBeenCalled()
  })

  it('returns 429 before any spend when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(429)
    expect(mockRunAgentSearch).not.toHaveBeenCalled()
  })

  it('returns 429 before any spend when the daily AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(429)
    expect(mockRunAgentSearch).not.toHaveBeenCalled()
  })

  it('streams status events then a results event for a valid hirer run', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockRunAgentSearch.mockImplementation(async ({ onEvent }: { onEvent?: (e: object) => void }) => {
      onEvent?.({ type: 'status', message: 'Searching: "dancers"' })
      return {
        summary: 'Found 1 strong match.',
        results: [{ profile: { id: 'p1' }, match_score: 90, match_reasons: ['Ballet trained'] }],
        searches: 1,
      }
    })

    const res = await POST(makeRequest({ query: 'dancers in London', filters: { gender: ['female'] } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/x-ndjson')

    const events = await readEvents(res)
    expect(events[0]).toEqual({ type: 'status', message: 'Searching: "dancers"' })
    const final = events[events.length - 1]
    expect(final.type).toBe('results')
    expect(final.summary).toBe('Found 1 strong match.')
    expect(final.results).toHaveLength(1)
    expect(mockRunAgentSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dancers in London', filters: { gender: ['female'] } }),
    )
  })

  it('streams an error event (not a crash) when the agent fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockRunAgentSearch.mockRejectedValue(new Error('upstream timeout'))
    const res = await POST(makeRequest({ query: 'dancers in London' }))
    expect(res.status).toBe(200)
    const events = await readEvents(res)
    expect(events[events.length - 1]).toEqual({ type: 'error', error: 'Deep search is temporarily unavailable' })
  })
})
