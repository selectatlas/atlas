import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const JOB_ID = '33333333-3333-4333-8333-333333333333'

function makeClient({
  user,
  accountType,
  job,
  insertError,
  rpcError,
}: {
  user: { id: string } | null
  accountType: string | null
  job?: { id: string; status: string; title?: string } | null
  insertError?: { code: string } | null
  rpcError?: { code: string } | null
}) {
  const messageInsert = vi.fn().mockResolvedValue({ error: null })
  const rpc = vi.fn().mockResolvedValue({
    data: rpcError ? null : 'thread-1',
    error: rpcError ?? null,
  })
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { account_type: accountType } }) }) }),
        }
      }
      if (table === 'jobs') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: job ?? null }) }) }),
        }
      }
      if (table === 'messages') {
        return { insert: messageInsert }
      }
      // applications
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: insertError ? null : { id: 'app-1', job_id: JOB_ID, talent_id: user?.id, status: 'sent' },
              error: insertError ?? null,
            }),
          }),
        }),
      }
    }),
    _messageInsert: messageInsert,
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/applications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null, accountType: null }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as hirer (not talent)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent' }))
    const res = await POST(makeRequest('{broken'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-uuid job_id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent' }))
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the note is too long', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: { id: JOB_ID, status: 'open' } }))
    const res = await POST(makeRequest({ job_id: JOB_ID, note: 'x'.repeat(1001) }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: { id: JOB_ID, status: 'open' } }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(429)
  })

  it('returns 404 when job does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: null }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when job is closed', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: { id: JOB_ID, status: 'closed' } }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(409)
  })

  it('returns 201 on successful application', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: { id: JOB_ID, status: 'open' } }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.application).toBeDefined()
  })

  it('accepts an optional application note', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: { id: JOB_ID, status: 'open' } }))
    const res = await POST(makeRequest({ job_id: JOB_ID, note: 'I am available for the shoot dates.' }))
    expect(res.status).toBe(201)
  })

  it('emits an application_received system card into the hirer thread', async () => {
    const client = makeClient({
      user: { id: 'u1' },
      accountType: 'talent',
      job: { id: JOB_ID, status: 'open', title: 'West End Revival' },
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(201)
    expect(client.rpc).toHaveBeenCalledWith('create_or_get_thread_for_application', {
      target_application_id: 'app-1',
    })
    expect(client._messageInsert).toHaveBeenCalledWith({
      thread_id: 'thread-1',
      sender_id: 'u1',
      content: 'Applied to West End Revival',
      kind: 'application_received',
    })
  })

  it('still returns 201 when the system card thread cannot be created', async () => {
    const client = makeClient({
      user: { id: 'u1' },
      accountType: 'talent',
      job: { id: JOB_ID, status: 'open', title: 'West End Revival' },
      rpcError: { code: '42883' },
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(201)
    expect(client._messageInsert).not.toHaveBeenCalled()
  })

  it('returns 409 when already applied (unique constraint)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      user: { id: 'u1' }, accountType: 'talent',
      job: { id: JOB_ID, status: 'open' },
      insertError: { code: '23505' },
    }))
    const res = await POST(makeRequest({ job_id: JOB_ID }))
    expect(res.status).toBe(409)
  })
})
