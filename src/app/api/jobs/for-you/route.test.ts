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

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

function jobId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function makeClient(
  user: { id: string } | null,
  accountType: string | null,
  options: {
    matches?: Array<{ job_id: string; similarity: number; category_match: boolean; skill_overlap: number }>
    jobs?: Record<string, unknown>[]
  } = {},
) {
  const jobsQuery: Record<string, unknown> = {}
  for (const method of ['select', 'in', 'eq', 'is']) {
    jobsQuery[method] = vi.fn(() => jobsQuery)
  }
  ;(jobsQuery as { then?: unknown }).then = (resolve: (value: unknown) => void) =>
    resolve({ data: options.jobs ?? [], error: null })

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn((fn: string) => {
      if (fn === 'is_caller_suspended') return Promise.resolve({ data: false, error: null })
      return Promise.resolve({ data: options.matches ?? [], error: null })
    }),
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: { account_type: accountType } }) }),
          }),
        }
      }
      return jobsQuery
    }),
  }
}

describe('GET /api/jobs/for-you', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for a hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'hirer-1' }, 'hirer'))
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns the ranked stack with real display scores, preserving RPC order', async () => {
    const matches = [
      { job_id: jobId(2), similarity: 0.7, category_match: true, skill_overlap: 2 },
      { job_id: jobId(1), similarity: 0.65, category_match: false, skill_overlap: 0 },
    ]
    const jobs = [
      { id: jobId(1), title: 'B', category: 'dancer' },
      { id: jobId(2), title: 'A', category: 'dancer' },
    ]
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent', { matches, jobs }))
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.jobs.map((job: { id: string }) => job.id)).toEqual([jobId(2), jobId(1)])
    expect(data.jobs[0]).toMatchObject({ match_score: 84, category_match: true, skill_overlap: 2 })
    expect(data.jobs[1]).toMatchObject({ match_score: 78, category_match: false })
  })

  it('returns an empty stack when the talent has no profile embedding yet', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent', { matches: [] }))
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ jobs: [] })
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent'))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await GET()
    expect(res.status).toBe(429)
  })
})
