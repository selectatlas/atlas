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
vi.mock('@/lib/job-embedding', () => ({
  embedJob: vi.fn().mockResolvedValue({ status: 'complete' }),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { GET, POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { embedJob } from '@/lib/job-embedding'
import { enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEmbedJob = embedJob as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

const FAILED_JOB = { id: 'job-1', title: 'Shoot', description: 'A shoot', skills_required: [] }

function makeClient(user: { id: string } | null, accountType: string | null, pendingJobs: object[] = []) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: accountType ? { account_type: accountType } : null }) }) }),
        }
      }
      // jobs
      return {
        select: () => ({
          eq: () => ({
            neq: () => {
              const result = {
                order: () => Promise.resolve({ data: pendingJobs }),
                limit: () => Promise.resolve({ data: pendingJobs }),
              }
              return result
            },
          }),
        }),
      }
    }),
  }
}

describe('GET /api/jobs/embeddings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    expect((await GET()).status).toBe(401)
  })

  it('lists jobs with incomplete embeddings', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer', [FAILED_JOB]))
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.jobs).toHaveLength(1)
  })
})

describe('POST /api/jobs/embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedJob.mockResolvedValue({ status: 'complete' })
    mockEnforceAiQuota.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    expect((await POST()).status).toBe(401)
  })

  it('returns 403 for a talent caller', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'talent'))
    expect((await POST()).status).toBe(403)
    expect(mockEmbedJob).not.toHaveBeenCalled()
  })

  it('returns 429 before reprocessing when the AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer', [FAILED_JOB]))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    expect((await POST()).status).toBe(429)
    expect(mockEmbedJob).not.toHaveBeenCalled()
  })

  it('reprocesses each incomplete job exactly once', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, 'hirer', [FAILED_JOB]))
    const res = await POST()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.reprocessed).toEqual([{ job_id: 'job-1', status: 'complete' }])
    expect(mockEmbedJob).toHaveBeenCalledTimes(1)
    expect(mockEmbedJob).toHaveBeenCalledWith(FAILED_JOB)
  })
})
