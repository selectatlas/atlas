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

const TALENT_ID = '11111111-1111-4111-8111-111111111111'

function makeClient({
  user,
  accountType,
  talentExists = true,
  existingShortlist = null,
}: {
  user: { id: string } | null
  accountType: string | null
  talentExists?: boolean
  existingShortlist?: { id: string } | null
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: accountType ? { account_type: accountType } : null }),
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: talentExists ? { id: TALENT_ID } : null }),
              }),
            }),
          }),
        }
      }
      // shortlists
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: existingShortlist }) }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }
    }),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/shortlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/shortlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null, accountType: null }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as talent (cross-role)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent' }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for malformed JSON and non-uuid talent_id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
    expect((await POST(makeRequest({ talent_id: 'talent-1' }))).status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID }))
    expect(res.status).toBe(429)
  })

  it('returns 404 when the target is not a talent profile', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer', talentExists: false }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID }))
    expect(res.status).toBe(404)
  })

  it('shortlists a talent as hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ shortlisted: true })
  })

  it('removes an existing shortlist entry (toggle off)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      user: { id: 'u1' }, accountType: 'hirer', existingShortlist: { id: 'sl-1' },
    }))
    const res = await POST(makeRequest({ talent_id: TALENT_ID }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ shortlisted: false })
  })
})
