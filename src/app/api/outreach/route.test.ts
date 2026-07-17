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
vi.mock('@/lib/openai', () => ({
  generateOutreachMessage: vi.fn().mockResolvedValue('Hi Asha, loved your work.'),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { generateOutreachMessage } from '@/lib/openai'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockGenerate = generateOutreachMessage as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

const TALENT_ID = '11111111-1111-4111-8111-111111111111'

function makeClient({
  user,
  accountType,
  talent,
  jobTitle,
  outreachInsertError,
  messageInsertError,
  rpcError,
}: {
  user: { id: string } | null
  accountType: string | null
  talent?: Record<string, unknown> | null
  jobTitle?: string | null
  outreachInsertError?: { code: string } | null
  messageInsertError?: { code: string } | null
  rpcError?: { code: string } | null
}) {
  const outreachInsert = vi.fn(() => ({
    select: () => ({
      single: () =>
        Promise.resolve({
          data: outreachInsertError ? null : { id: 'outreach-1' },
          error: outreachInsertError ?? null,
        }),
    }),
  }))
  const outreachUpdate = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
  const messageInsert = vi.fn().mockResolvedValue({ error: messageInsertError ?? null })
  const rpc = vi.fn().mockResolvedValue({
    data: rpcError ? null : 'thread-1',
    error: rpcError ?? null,
  })
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: (fields: string) => ({
            eq: (column: string) => {
              if (fields.includes('account_type') && column === 'id') {
                return {
                  single: () => Promise.resolve({ data: accountType ? { account_type: accountType, full_name: 'Hirer Name' } : null }),
                  eq: () => ({ single: () => Promise.resolve({ data: talent ?? null }) }),
                }
              }
              return { single: () => Promise.resolve({ data: null }) }
            },
          }),
        }
      }
      if (table === 'messages') {
        return { insert: messageInsert }
      }
      if (table === 'jobs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: jobTitle ? { title: jobTitle } : null }),
            }),
          }),
        }
      }
      return { insert: outreachInsert, update: outreachUpdate }
    }),
    rpc,
    _outreachInsert: outreachInsert,
    _outreachUpdate: outreachUpdate,
    _messageInsert: messageInsert,
  }
}

const talentProfile = {
  id: TALENT_ID,
  full_name: 'Asha Rao',
  bio: 'Dancer from London',
  talent_skills: [{ skill: 'Bollywood' }],
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/outreach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/outreach', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
    mockGenerate.mockResolvedValue('Hi Asha, loved your work.')
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null, accountType: null }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'generate' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    const res = await POST(makeRequest('{broken'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-uuid talent_id or invalid action', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile }))
    expect((await POST(makeRequest({ talent_id: 'talent-1', action: 'generate' }))).status).toBe(400)
    expect((await POST(makeRequest({ talent_id: TALENT_ID, action: 'delete' }))).status).toBe(400)
  })

  it('returns 403 for a talent caller without calling OpenAI', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', talent: talentProfile }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'generate' }))
    expect(res.status).toBe(403)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns 404 when the target is not a talent profile', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: null }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'generate' }))
    expect(res.status).toBe(404)
  })

  it('returns 429 before any OpenAI spend when the AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile }))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'generate' }))
    expect(res.status).toBe(429)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('generates a message for a valid hirer request', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'generate' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toBe('Hi Asha, loved your work.')
  })

  it('returns 503 (not a crash) when OpenAI fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile }))
    mockGenerate.mockRejectedValue(new Error('upstream timeout'))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'generate' }))
    expect(res.status).toBe(503)
  })

  it('returns 500 and demotes the tracking row when thread creation fails, without leaking database errors', async () => {
    const client = makeClient({
      user: { id: 'u1' },
      accountType: 'hirer',
      talent: talentProfile,
      rpcError: { code: '42501' },
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'send', message: 'Hello!' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Failed to start conversation')
    expect(client._outreachUpdate).toHaveBeenCalledWith({ status: 'draft' })
  })

  it('returns 500 when the outreach tracking insert fails (nothing has been delivered yet)', async () => {
    const client = makeClient({
      user: { id: 'u1' },
      accountType: 'hirer',
      talent: talentProfile,
      outreachInsertError: { code: '23503' },
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'send', message: 'Hello!' }))
    expect(res.status).toBe(500)
    expect(client._messageInsert).not.toHaveBeenCalled()
  })

  it('sends through the origin-aware RPC and records a job origin when provided', async () => {
    const JOB_ID = '33333333-3333-4333-8333-333333333333'
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'send', message: 'Hello!', job_id: JOB_ID }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.thread_id).toBe('thread-1')
    expect(client.rpc).toHaveBeenCalledWith('create_or_get_thread_with_origin', {
      other_profile_id: TALENT_ID,
      origin_outreach: 'outreach-1',
      origin_job: JOB_ID,
    })
  })

  it('emits an outreach_sent system card before the mirrored message', async () => {
    const JOB_ID = '33333333-3333-4333-8333-333333333333'
    const client = makeClient({
      user: { id: 'u1' },
      accountType: 'hirer',
      talent: talentProfile,
      jobTitle: 'West End Revival',
    })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'send', message: 'Hello!', job_id: JOB_ID }))
    expect(res.status).toBe(200)
    expect(client._messageInsert).toHaveBeenCalledTimes(2)
    expect(client._messageInsert.mock.calls[0][0]).toEqual({
      thread_id: 'thread-1',
      sender_id: 'u1',
      content: 'Reached out about West End Revival',
      kind: 'outreach_sent',
    })
    expect(client._messageInsert.mock.calls[1][0]).toEqual({
      thread_id: 'thread-1',
      sender_id: 'u1',
      content: 'Hello!',
    })
  })

  it('uses a generic outreach card without a job', async () => {
    const client = makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'send', message: 'Hello!' }))
    expect(res.status).toBe(200)
    expect(client._messageInsert.mock.calls[0][0]).toMatchObject({
      content: 'Reached out to start a conversation',
      kind: 'outreach_sent',
    })
  })

  it('rejects a non-uuid job_id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'send', message: 'Hello!', job_id: 'job-1' }))
    expect(res.status).toBe(400)
  })

  it('rejects an oversized outreach message', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talent: talentProfile }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID, action: 'send', message: 'x'.repeat(2001) }))
    expect(res.status).toBe(400)
  })
})
