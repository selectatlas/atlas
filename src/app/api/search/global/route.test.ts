import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/openai', () => ({
  parseSearchQuery: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseSearchQuery } from '@/lib/openai'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>
const mockParseSearchQuery = parseSearchQuery as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

const EMPTY_PARSE = {
  category: null, skills: [], location: null, availability: null,
  languages: [], gender: [], age_min: null, age_max: null, spact: null,
}

type Rows = {
  talent?: unknown[]
  jobs?: unknown[]
  messages?: unknown[]
  participants?: unknown[]
}

/**
 * A thenable chain that ignores which filters were applied and resolves with
 * whatever rows the test staged for that table.
 */
function tableChain(rows: unknown[], orFilters?: string[]) {
  const result = Promise.resolve({ data: rows, error: null })
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'ilike', 'in', 'eq', 'order', 'limit']) {
    chain[method] = () => chain
  }
  // Captured so tests can assert how the fallback composed its filter.
  chain.or = (expression: string) => {
    orFilters?.push(expression)
    return chain
  }
  chain.then = result.then.bind(result)
  return chain
}

function makeClient(
  user: { id: string } | null,
  accountType: string | null,
  rows: Rows = {},
) {
  const calls: string[] = []
  const orFilters: string[] = []
  const client = {
    calls,
    orFilters,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    from: vi.fn((table: string) => {
      calls.push(table)
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: accountType ? { account_type: accountType } : null,
              }),
            }),
          }),
        }
      }
      if (table === 'public_talent_profiles') return tableChain(rows.talent ?? [], orFilters)
      if (table === 'public_open_jobs') return tableChain(rows.jobs ?? [], orFilters)
      if (table === 'thread_participants') return tableChain(rows.participants ?? [])
      if (table === 'messages') return tableChain(rows.messages ?? [])
      return tableChain([])
    }),
  }
  return client
}

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
  return new Request('http://localhost/api/search/global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/search/global', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateServiceClient.mockReturnValue(makeServiceClient())
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
    mockParseSearchQuery.mockResolvedValue({ ...EMPTY_PARSE })
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await POST(makeRequest({ query: 'priya' }))
    expect(res.status).toBe(401)
  })

  it('serves both account types - global search is not role-gated', async () => {
    for (const accountType of ['hirer', 'talent']) {
      mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, accountType))
      const res = await POST(makeRequest({ query: 'priya' }))
      expect(res.status).toBe(200)
    }
  })

  it('returns 403 for a suspended caller', async () => {
    const client = makeClient({ id: 'u1' }, 'hirer')
    client.rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ query: 'priya' }))
    expect(res.status).toBe(403)
  })

  it('groups plain matches by category, people first', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer', {
      talent: [{ id: 't1', full_name: 'Priya Sharma', headline: 'Dancer', city: 'London' }],
      jobs: [{ id: 'j1', title: 'Music video dancer', location: 'London' }],
    }))

    const res = await POST(makeRequest({ query: 'priya' }))
    const body = await res.json()

    expect(body.groups.map((g: { category: string }) => g.category)).toEqual(['talent', 'jobs'])
    expect(body.groups[0].hits[0].title).toBe('Priya Sharma')
    expect(body.groups[0].hits[0].href).toBe('/talent/t1')
    expect(body.usedAi).toBe(false)
  })

  it('scopes message matches to the caller\'s own threads', async () => {
    const client = makeClient({ id: 'u1' }, 'talent', {
      participants: [{ thread_id: 'th1' }],
      messages: [{ id: 'm1', thread_id: 'th1', content: 'about the shoot' }],
    })
    mockCreateClient.mockResolvedValue(client)

    const res = await POST(makeRequest({ query: 'shoot' }))
    const body = await res.json()

    // The participant lookup is the ownership check and must always run.
    expect(client.calls).toContain('thread_participants')
    const messages = body.groups.find((g: { category: string }) => g.category === 'messages')
    expect(messages.hits[0].href).toBe('/messages/th1')
  })

  it('skips the message query entirely when the caller has no threads', async () => {
    const client = makeClient({ id: 'u1' }, 'talent', { participants: [] })
    mockCreateClient.mockResolvedValue(client)

    await POST(makeRequest({ query: 'shoot' }))

    expect(client.calls).toContain('thread_participants')
    expect(client.calls).not.toContain('messages')
  })

  it('matches static destinations without touching the database', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    const res = await POST(makeRequest({ query: 'settings' }))
    const body = await res.json()
    const settings = body.groups.find((g: { category: string }) => g.category === 'settings')
    expect(settings.hits.some((h: { href: string }) => h.href === '/settings')).toBe(true)
  })

  it('does not spend AI quota when any plain match succeeded', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer', {
      talent: [{ id: 't1', full_name: 'Priya', headline: null, city: null }],
    }))
    await POST(makeRequest({ query: 'priya' }))
    expect(mockEnforceAiQuota).not.toHaveBeenCalled()
    expect(mockParseSearchQuery).not.toHaveBeenCalled()
  })

  it('falls back to the AI parser only when every surface came back empty', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockParseSearchQuery.mockResolvedValue({ ...EMPTY_PARSE, category: 'dancer', location: 'London' })

    const res = await POST(makeRequest({ query: 'zzzq nothing matches' }))
    const body = await res.json()

    expect(mockParseSearchQuery).toHaveBeenCalled()
    expect(body.usedAi).toBe(true)
  })

  it('enforces the AI quota before the fallback parse', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Daily limit reached' }, { status: 429 }))

    const res = await POST(makeRequest({ query: 'zzzq nothing matches' }))
    expect(res.status).toBe(429)
    expect(mockParseSearchQuery).not.toHaveBeenCalled()
  })

  it('still answers when the fallback parse throws, without leaking the error', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockParseSearchQuery.mockRejectedValue(new Error('openai exploded: key sk-secret'))

    const res = await POST(makeRequest({ query: 'zzzq nothing matches' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groups).toEqual([])
    expect(JSON.stringify(body)).not.toContain('sk-secret')
  })

  it('returns an empty result for a query too short to route', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    const res = await POST(makeRequest({ query: 'a' }))
    const body = await res.json()
    expect(body.groups).toEqual([])
    expect(mockEnforceRateLimit).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON or a missing query', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
    expect((await POST(makeRequest({}))).status).toBe(400)
  })

  it('returns 429 when the plain-match rate limit trips', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer'))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ query: 'priya' }))
    expect(res.status).toBe(429)
  })
})
