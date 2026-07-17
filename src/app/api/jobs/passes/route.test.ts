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

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const JOB_ID = 'a1b2c3d4-0000-4000-8000-000000000001'

function makeClient(
  user: { id: string } | null,
  accountType: string | null,
  upsertError: { code: string } | null = null,
) {
  const upsert = vi.fn(() => Promise.resolve({ error: upsertError }))
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      // is_caller_suspended check in getAuthenticatedCaller
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: { account_type: accountType } }) }),
            }),
          }
        }
        return { upsert }
      }),
    },
    upsert,
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/jobs/passes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/jobs/passes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null).client)
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as hirer (not talent)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'hirer-1' }, 'hirer').client)
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(403)
  })

  it('records a pass for a talent', async () => {
    const { client, upsert } = makeClient({ id: 'talent-1' }, 'talent')
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(
      { talent_id: 'talent-1', job_id: JOB_ID },
      { onConflict: 'talent_id,job_id', ignoreDuplicates: true },
    )
  })

  it('returns 400 for a malformed job_id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent').client)
    const res = await POST(makeRequest({ job_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the job does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent', { code: '23503' }).client)
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(404)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent').client)
    const res = await POST(makeRequest('{broken'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when the pass rate limit trips', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }, 'talent').client)
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(429)
  })
})
