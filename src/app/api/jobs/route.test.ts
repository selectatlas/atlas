import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase/server, job embedding, and rate limiting before importing the route
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
vi.mock('@/lib/job-embedding', () => ({
  embedJob: vi.fn().mockResolvedValue({ status: 'complete' }),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST, GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { embedJob } from '@/lib/job-embedding'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { DISCOVER_PAGE_SIZE } from '@/lib/job-discovery'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEmbedJob = embedJob as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

function makeClient(user: { id: string } | null, accountType: string | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    // is_caller_suspended check in getAuthenticatedCaller
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { account_type: accountType } }),
            }),
          }),
        }
      }
      // jobs table insert
      return {
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'job-1', title: 'Test Job', ...row }, error: null }),
          }),
        }),
      }
    }),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBody = {
  title: 'Bollywood dancers needed',
  description: 'Music video shoot in London',
  category: 'dancer',
  skills_required: ['Bollywood'],
  location: 'London',
  budget: '£500/day',
}

describe('POST /api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedJob.mockResolvedValue({ status: 'complete' })
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as talent (not hirer)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'talent'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 201 and job with embedding status when hirer posts valid job', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.job).toBeDefined()
    expect(data.job.embedding_status).toBe('complete')
    // Embedding is awaited exactly once per created job (idempotent upsert)
    expect(mockEmbedJob).toHaveBeenCalledTimes(1)
  })

  it('reports a failed embedding honestly instead of dropping it', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    mockEmbedJob.mockResolvedValue({ status: 'failed' })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.job.embedding_status).toBe('failed')
  })

  it('returns 400 when required fields are missing', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ title: '', description: '', category: 'dancer', location: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest('{broken'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an oversized title', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, title: 'x'.repeat(201) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid category', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, category: 'astronaut' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for too many skills', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, skills_required: Array(21).fill('skill') }))
    expect(res.status).toBe(400)
  })

  it('returns 413 for an oversized request body', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, description: 'x'.repeat(200_000) }))
    expect(res.status).toBe(413)
  })

  it('persists logistics fields when provided', async () => {
    let inserted: Record<string, unknown> | null = null
    const client = makeClient({ id: 'user-1' }, 'hirer')
    const originalFrom = client.from
    client.from = vi.fn((table: string) => {
      if (table !== 'jobs') return originalFrom(table)
      return {
        insert: (row: Record<string, unknown>) => {
          inserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'job-1', title: 'Test Job', ...row }, error: null }),
            }),
          }
        },
      }
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({
      ...validBody,
      work_type: 'in_person',
      start_date: '2026-08-16',
      end_date: '2026-09-13',
      application_deadline: '2026-07-29',
      duration: '2 rehearsal weeks + 12 tour dates',
      usage_rights: 'Tour visuals + social coverage, 18 months',
      travel_required: true,
    }))
    expect(res.status).toBe(201)
    expect(inserted).toMatchObject({
      work_type: 'in_person',
      start_date: '2026-08-16',
      end_date: '2026-09-13',
      application_deadline: '2026-07-29',
      duration: '2 rehearsal weeks + 12 tour dates',
      usage_rights: 'Tour visuals + social coverage, 18 months',
      travel_required: true,
    })
  })

  it('defaults logistics fields to null/false when omitted', async () => {
    let inserted: Record<string, unknown> | null = null
    const client = makeClient({ id: 'user-1' }, 'hirer')
    const originalFrom = client.from
    client.from = vi.fn((table: string) => {
      if (table !== 'jobs') return originalFrom(table)
      return {
        insert: (row: Record<string, unknown>) => {
          inserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'job-1', title: 'Test Job', ...row }, error: null }),
            }),
          }
        },
      }
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    expect(inserted).toMatchObject({
      work_type: null,
      start_date: null,
      end_date: null,
      application_deadline: null,
      duration: null,
      usage_rights: null,
      travel_required: false,
    })
  })

  it('returns 400 for an invalid work_type', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, work_type: 'on_the_moon' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a malformed start_date', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, start_date: '16/08/2026' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-boolean travel_required', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, travel_required: 'yes' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 without creating a job when the AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
    expect(mockEmbedJob).not.toHaveBeenCalled()
  })

  it('derives structured budget bounds from the budget text', async () => {
    let inserted: Record<string, unknown> | null = null
    const client = makeClient({ id: 'user-1' }, 'hirer')
    const originalFrom = client.from
    client.from = vi.fn((table: string) => {
      if (table !== 'jobs') return originalFrom(table)
      return {
        insert: (row: Record<string, unknown>) => {
          inserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'job-1', title: 'Test Job', ...row }, error: null }),
            }),
          }
        },
      }
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ ...validBody, budget: '£250 - £500' }))
    expect(res.status).toBe(201)
    expect(inserted).toMatchObject({ budget_min: 250, budget_max: 500 })
  })
})

function fakeJobId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function makeFeedJobs(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: fakeJobId(index),
    title: `Job ${index}`,
    category: 'dancer',
    location: 'London',
    created_at: `2026-07-${String(17 - (index % 16)).padStart(2, '0')}T10:00:00+00:00`,
    budget_max: 400,
    budget_min: 300,
  }))
}

function makeFeedClient(
  user: { id: string } | null,
  accountType: string | null,
  options: {
    jobs?: Record<string, unknown>[]
    count?: number
    passes?: { job_id: string }[]
    /** First query resolution fails with this error code; later ones succeed. */
    failFirstWithCode?: string
  } = {},
) {
  const jobsQuery: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'is', 'not', 'or', 'order', 'limit', 'lt', 'gt', 'gte', 'lte', 'textSearch']) {
    jobsQuery[method] = vi.fn(() => jobsQuery)
  }
  const rows = options.jobs ?? []
  let resolutions = 0
  ;(jobsQuery as { then?: unknown }).then = (resolve: (value: unknown) => void) => {
    resolutions += 1
    if (options.failFirstWithCode && resolutions === 1) {
      resolve({ data: null, error: { code: options.failFirstWithCode }, count: null })
      return
    }
    resolve({ data: rows, error: null, count: options.count ?? rows.length })
  }

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    // is_caller_suspended check in getAuthenticatedCaller
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: { account_type: accountType } }) }),
          }),
        }
      }
      if (table === 'job_passes') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: options.passes ?? [] }) }),
            }),
          }),
        }
      }
      return jobsQuery
    }),
  }
  return { client, jobsQuery }
}

function makeGetRequest(query = '') {
  return new Request(`http://localhost/api/jobs${query}`)
}

describe('GET /api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeFeedClient(null, null)
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns a page of open jobs with a total for a talent', async () => {
    const { client, jobsQuery } = makeFeedClient({ id: 'talent-1' }, 'talent', {
      jobs: makeFeedJobs(3),
      count: 3,
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(makeGetRequest('?category=dancer'))
    expect(res.status).toBe(200)
    const page = await res.json()
    expect(page.jobs).toHaveLength(3)
    expect(page.nextCursor).toBeNull()
    expect(page.total).toBe(3)
    expect(jobsQuery.eq).toHaveBeenCalledWith('status', 'open')
    expect(jobsQuery.in).toHaveBeenCalledWith('category', ['dancer'])
    expect(jobsQuery.is).toHaveBeenCalledWith('removed_at', null)
  })

  it('slices to the page size and returns a cursor when more rows exist', async () => {
    const { client } = makeFeedClient({ id: 'talent-1' }, 'talent', {
      jobs: makeFeedJobs(DISCOVER_PAGE_SIZE + 1),
      count: 100,
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(makeGetRequest())
    const page = await res.json()
    expect(page.jobs).toHaveLength(DISCOVER_PAGE_SIZE)
    expect(page.nextCursor).toEqual(expect.any(String))
  })

  it("excludes the talent's passed jobs from the feed query", async () => {
    const passedId = fakeJobId(99)
    const { client, jobsQuery } = makeFeedClient({ id: 'talent-1' }, 'talent', {
      passes: [{ job_id: passedId }],
    })
    mockCreateClient.mockResolvedValue(client)
    await GET(makeGetRequest())
    expect(jobsQuery.not).toHaveBeenCalledWith('id', 'in', `(${passedId})`)
  })

  it('lets a hirer list jobs without touching job_passes', async () => {
    const { client } = makeFeedClient({ id: 'hirer-1' }, 'hirer', { jobs: makeFeedJobs(1) })
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(client.from).not.toHaveBeenCalledWith('job_passes')
  })

  it('returns 400 for invalid filter values and cursors', async () => {
    const { client } = makeFeedClient({ id: 'talent-1' }, 'talent')
    mockCreateClient.mockResolvedValue(client)
    expect((await GET(makeGetRequest('?category=astronaut'))).status).toBe(400)
    expect((await GET(makeGetRequest('?sort=random'))).status).toBe(400)
    expect((await GET(makeGetRequest('?cursor=!!!'))).status).toBe(400)
  })

  it('returns 429 when the listing rate limit trips', async () => {
    const { client } = makeFeedClient({ id: 'talent-1' }, 'talent')
    mockCreateClient.mockResolvedValue(client)
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(429)
  })

  it('searches via full-text search', async () => {
    const { client, jobsQuery } = makeFeedClient({ id: 'talent-1' }, 'talent', { jobs: makeFeedJobs(1) })
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(makeGetRequest('?q=ballet'))
    expect(res.status).toBe(200)
    expect(jobsQuery.textSearch).toHaveBeenCalledWith('search_tsv', 'ballet', { type: 'websearch', config: 'english' })
  })

  it('falls back to substring search when the FTS column is missing', async () => {
    const { client, jobsQuery } = makeFeedClient({ id: 'talent-1' }, 'talent', {
      jobs: makeFeedJobs(1),
      failFirstWithCode: '42703',
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(makeGetRequest('?q=ballet'))
    expect(res.status).toBe(200)
    const page = await res.json()
    expect(page.jobs).toHaveLength(1)
    expect(jobsQuery.or).toHaveBeenCalledWith(
      'title.ilike."%ballet%",description.ilike."%ballet%",location.ilike."%ballet%"',
    )
  })

  it('returns only the total in count mode', async () => {
    const { client, jobsQuery } = makeFeedClient({ id: 'talent-1' }, 'talent', { count: 42 })
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(makeGetRequest('?count=1&work=remote'))
    expect(res.status).toBe(200)
    const page = await res.json()
    expect(page).toEqual({ jobs: [], nextCursor: null, total: 42 })
    expect(jobsQuery.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    // Count mode never orders or paginates
    expect(jobsQuery.order).not.toHaveBeenCalled()
    expect(jobsQuery.limit).not.toHaveBeenCalled()
  })
})
