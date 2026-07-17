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
}))

import { GET, POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const ALERT_ROW = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  name: 'Remote dance work',
  query: '',
  filters: { work: 'remote' },
  last_viewed_at: '2026-07-01T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
}

function makeClient(
  user: { id: string } | null,
  accountType: string | null,
  options: {
    alerts?: Record<string, unknown>[]
    existingCount?: number
    newJobsCount?: number
    insertError?: { code: string } | null
  } = {},
) {
  // Alert count queries run through the jobs table in count-only mode.
  const jobsQuery: Record<string, unknown> = {}
  for (const method of ['select', 'in', 'eq', 'is', 'not', 'or', 'order', 'limit', 'lt', 'gt', 'gte', 'lte', 'textSearch']) {
    jobsQuery[method] = vi.fn(() => jobsQuery)
  }
  ;(jobsQuery as { then?: unknown }).then = (resolve: (value: unknown) => void) =>
    resolve({ data: [], error: null, count: options.newJobsCount ?? 0 })

  const insert = vi.fn(() => ({
    select: () => ({
      single: () => Promise.resolve(
        options.insertError
          ? { data: null, error: options.insertError }
          : { data: { ...ALERT_ROW, id: 'a1b2c3d4-0000-4000-8000-000000000009' }, error: null },
      ),
    }),
  }))

  const alertsTable = {
    insert,
    select: vi.fn((_columns?: string, selectOptions?: { count?: string; head?: boolean }) => {
      if (selectOptions?.head) {
        return { eq: () => Promise.resolve({ count: options.existingCount ?? 0 }) }
      }
      return {
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: options.alerts ?? [], error: null }),
          }),
        }),
      }
    }),
  }

  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: { account_type: accountType } }) }),
            }),
          }
        }
        if (table === 'job_alerts') return alertsTable
        return jobsQuery
      }),
    },
    insert,
    jobsQuery,
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/jobs/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('GET /api/jobs/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null).client)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for a hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'hirer-1' }, 'hirer').client)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('lists alerts with read-time new-match counts', async () => {
    const { client, jobsQuery } = makeClient({ id: 'talent-1' }, 'talent', {
      alerts: [ALERT_ROW],
      newJobsCount: 4,
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alerts).toHaveLength(1)
    expect(data.alerts[0]).toMatchObject({ id: ALERT_ROW.id, name: ALERT_ROW.name, new_count: 4 })
    // The count only looks at jobs created since the alert was last viewed
    expect(jobsQuery.gt).toHaveBeenCalledWith('created_at', ALERT_ROW.last_viewed_at)
  })
})

describe('POST /api/jobs/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null).client)
    const res = await POST(makeRequest({ name: 'X', query: 'ballet' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'hirer-1' }, 'hirer').client)
    const res = await POST(makeRequest({ name: 'X', query: 'ballet' }))
    expect(res.status).toBe(403)
  })

  it('creates an alert from a search and filters', async () => {
    const { client, insert } = makeClient({ id: 'talent-1' }, 'talent')
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ name: 'Remote dance', query: 'ballet', filters: { work: 'remote' } }))
    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledWith({
      talent_id: 'talent-1',
      name: 'Remote dance',
      query: 'ballet',
      filters: { work: 'remote' },
    })
  })

  it('rejects invalid input', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent').client)
    expect((await POST(makeRequest({ query: 'ballet' }))).status).toBe(400)
    expect((await POST(makeRequest({ name: 'No scope' }))).status).toBe(400)
    expect((await POST(makeRequest({ name: 'Bad', filters: { work: 'moon' } }))).status).toBe(400)
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
  })

  it('enforces the per-talent alert cap', async () => {
    const { client, insert } = makeClient({ id: 'talent-1' }, 'talent', { existingCount: 10 })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ name: 'One more', query: 'ballet' }))
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent').client)
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ name: 'X', query: 'ballet' }))
    expect(res.status).toBe(429)
  })
})
