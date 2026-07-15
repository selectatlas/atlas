import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'

function makeClient(user: { id: string } | null, insertError: { code: string } | null = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({
            data: insertError ? null : { id: 'report-1', status: 'open', created_at: 'now' },
            error: insertError,
          }),
        }),
      }),
    })),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    expect((await POST(makeRequest({ reported_profile_id: TARGET_ID, reason: 'spam' }))).status).toBe(401)
  })

  it('requires a target and a valid reason', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    expect((await POST(makeRequest({ reason: 'spam' }))).status).toBe(400)
    expect((await POST(makeRequest({ reported_profile_id: 'nope', reason: 'spam' }))).status).toBe(400)
    expect((await POST(makeRequest({ reported_profile_id: TARGET_ID, reason: 'because' }))).status).toBe(400)
    expect((await POST(makeRequest({ reported_profile_id: USER_ID, reason: 'spam' }))).status).toBe(400)
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
  })

  it('rejects oversized details', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    const res = await POST(makeRequest({ reported_profile_id: TARGET_ID, reason: 'spam', details: 'x'.repeat(2001) }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    expect((await POST(makeRequest({ reported_profile_id: TARGET_ID, reason: 'spam' }))).status).toBe(429)
  })

  it('creates an auditable report case', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    const res = await POST(makeRequest({ reported_profile_id: TARGET_ID, reason: 'harassment', details: 'Sent abusive messages' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.report.id).toBe('report-1')
    expect(data.report.status).toBe('open')
  })

  it('accepts job reports too', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    const res = await POST(makeRequest({ reported_job_id: TARGET_ID, reason: 'scam' }))
    expect(res.status).toBe(201)
  })
})
