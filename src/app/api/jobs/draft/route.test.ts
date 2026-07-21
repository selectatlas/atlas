import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  // getAuthenticatedCaller resolves the platform-admin role through the
  // service client; nobody in these tests is an admin.
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
  parseJobDraft: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { parseJobDraft } from '@/lib/openai'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { EMPTY_JOB_DRAFT } from '@/lib/job-draft'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockParseJobDraft = parseJobDraft as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

function makeClient(user: { id: string } | null, accountType: string | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { account_type: accountType } }),
        }),
      }),
    })),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/jobs/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const draft = {
  ...EMPTY_JOB_DRAFT,
  title: 'Contemporary dancers for music video',
  description: 'Casting three contemporary dancers for a one-day shoot in London.',
  category: 'dancer' as const,
  skills_required: ['Contemporary'],
  location: 'London, UK',
}

const validBody = { brief: '3 contemporary dancers for a London music video, £350/day' }

describe('POST /api/jobs/draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParseJobDraft.mockResolvedValue(draft)
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
    expect(mockParseJobDraft).not.toHaveBeenCalled()
  })

  it('returns 403 when authenticated as talent (not hirer)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'talent'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
    expect(mockParseJobDraft).not.toHaveBeenCalled()
  })

  it('returns the draft for a hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.draft).toEqual(draft)
    expect(mockParseJobDraft).toHaveBeenCalledTimes(1)
    expect(mockParseJobDraft).toHaveBeenCalledWith(validBody.brief, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('returns 400 when the brief is missing or empty', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    expect((await POST(makeRequest({}))).status).toBe(400)
    expect((await POST(makeRequest({ brief: '   ' }))).status).toBe(400)
    expect(mockParseJobDraft).not.toHaveBeenCalled()
  })

  it('returns 400 when the brief exceeds the length cap', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ brief: 'x'.repeat(1001) }))
    expect(res.status).toBe(400)
    expect(mockParseJobDraft).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest('{not json'))
    expect(res.status).toBe(400)
  })

  it('passes the rate limit response through without spending on OpenAI', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
    expect(mockParseJobDraft).not.toHaveBeenCalled()
  })

  it('passes the daily AI quota response through without spending on OpenAI', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Daily limit reached' }, { status: 429 }))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
    expect(mockParseJobDraft).not.toHaveBeenCalled()
  })

  it('returns 503 when the model call fails', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    mockParseJobDraft.mockRejectedValue(new Error('upstream timeout'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toBe('Drafting is temporarily unavailable')
  })
})
