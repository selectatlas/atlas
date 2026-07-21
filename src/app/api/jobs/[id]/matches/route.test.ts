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
vi.mock('@/lib/job-matching', () => ({
  matchTalentForJob: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { matchTalentForJob } from '@/lib/job-matching'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockMatchTalentForJob = matchTalentForJob as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

const JOB_ID = '11111111-1111-4111-8111-111111111111'

function makeClient(
  user: { id: string } | null,
  accountType: string | null,
  job: Record<string, unknown> | null,
) {
  return {
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
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: job, error: job ? null : { code: 'PGRST116' } }) }),
        }),
      }
    }),
  }
}

const ownedJob = {
  id: JOB_ID,
  hirer_id: 'user-1',
  title: 'Contemporary dancers',
  category: 'dancer',
  embedding_status: 'complete',
}

const matches = [{ profile: { id: 'talent-1' }, match_score: 88, match_reasons: ['Skill: Contemporary'] }]

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/jobs/[id]/matches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchTalentForJob.mockResolvedValue({ ok: true, results: matches })
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
  })

  it('returns 404 for a non-uuid id without touching auth', async () => {
    const res = await GET(new Request('http://localhost'), params('not-a-uuid'))
    expect(res.status).toBe(404)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null, ownedJob))
    const res = await GET(new Request('http://localhost'), params(JOB_ID))
    expect(res.status).toBe(401)
    expect(mockMatchTalentForJob).not.toHaveBeenCalled()
  })

  it('returns 404 when the job does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer', null))
    const res = await GET(new Request('http://localhost'), params(JOB_ID))
    expect(res.status).toBe(404)
    expect(mockMatchTalentForJob).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller does not own the job', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ id: 'user-2' }, 'hirer', { ...ownedJob, hirer_id: 'someone-else' }),
    )
    const res = await GET(new Request('http://localhost'), params(JOB_ID))
    expect(res.status).toBe(403)
    expect(mockMatchTalentForJob).not.toHaveBeenCalled()
  })

  it('returns ranked matches to the job owner', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer', ownedJob))
    const res = await GET(new Request('http://localhost'), params(JOB_ID))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.matches).toEqual(matches)
    expect(mockMatchTalentForJob).toHaveBeenCalledTimes(1)
  })

  it('skips the AI quota when the job already has an embedding', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer', ownedJob))
    await GET(new Request('http://localhost'), params(JOB_ID))
    expect(mockEnforceAiQuota).not.toHaveBeenCalled()
  })

  it('charges the AI quota when the job must be re-embedded on read', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ id: 'user-1' }, 'hirer', { ...ownedJob, embedding_status: 'failed' }),
    )
    await GET(new Request('http://localhost'), params(JOB_ID))
    expect(mockEnforceAiQuota).toHaveBeenCalledWith('user-1')
  })

  it('passes the rate limit response through', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer', ownedJob))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await GET(new Request('http://localhost'), params(JOB_ID))
    expect(res.status).toBe(429)
    expect(mockMatchTalentForJob).not.toHaveBeenCalled()
  })

  it('surfaces a matching failure with its own status', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer', ownedJob))
    mockMatchTalentForJob.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'Matching is temporarily unavailable',
    })
    const res = await GET(new Request('http://localhost'), params(JOB_ID))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toBe('Matching is temporarily unavailable')
  })
})
