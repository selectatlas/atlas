import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/openai', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/openai'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>
const mockEmbedText = embedText as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

const OWN_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

function makeClient(user: { id: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { id: OWN_ID, full_name: 'Asha', city: 'London', country: 'UK', bio: 'Dancer', talent_skills: [{ skill: 'Bollywood', category: 'dancer' }] },
          }),
        }),
      }),
    })),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/embed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0))
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: null }) })),
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(401)
  })

  it('returns 403 when targeting another profile, without calling OpenAI', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: OWN_ID }))
    const res = await POST(makeRequest({ profile_id: OTHER_ID }))
    expect(res.status).toBe(403)
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-uuid profile_id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: OWN_ID }))
    const res = await POST(makeRequest({ profile_id: 'profile-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 before any OpenAI spend when the AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: OWN_ID }))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ profile_id: OWN_ID }))
    expect(res.status).toBe(429)
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('embeds your own profile', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: OWN_ID }))
    const res = await POST(makeRequest({ profile_id: OWN_ID }))
    expect(res.status).toBe(200)
    expect(mockEmbedText).toHaveBeenCalledTimes(1)
  })

  it('defaults to your own profile when profile_id is omitted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: OWN_ID }))
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
  })
})
