import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const USER_ID = '11111111-1111-4111-8111-111111111111'

const VALID_BODY = {
  category: 'dancer',
  skills: ['Bollywood', 'Kathak'],
  headline: 'Bollywood Dancer | Choreographer',
  bio: 'Ten years performing across the UK.',
  city: 'London',
  country: 'UK',
  rates: '£300 per day',
  availableNow: true,
}

type ProfileRow = {
  account_type: string
  headline: string | null
  talent_skills: Array<{ id: string }>
} | null

function makeClient(user: { id: string } | null, profile: ProfileRow) {
  const profileUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const skillsInsert = vi.fn().mockResolvedValue({ error: null })
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: profile }) }) }),
            update: () => ({ eq: profileUpdateEq }),
          }
        }
        return { insert: skillsInsert }
      }),
    },
    profileUpdateEq,
    skillsInsert,
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const FRESH_TALENT: ProfileRow = { account_type: 'talent', headline: null, talent_skills: [] }

describe('POST /api/onboarding', () => {
  const attributesUpsert = vi.fn().mockResolvedValue({ error: null })

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
    attributesUpsert.mockResolvedValue({ error: null })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({ upsert: attributesUpsert })),
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null).client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 403 for hirer accounts, without writing anything', async () => {
    const { client, profileUpdateEq, skillsInsert } = makeClient(
      { id: USER_ID },
      { account_type: 'hirer', headline: null, talent_skills: [] },
    )
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    expect(profileUpdateEq).not.toHaveBeenCalled()
    expect(skillsInsert).not.toHaveBeenCalled()
  })

  it('returns 409 when the profile is already set up, preventing duplicate skills', async () => {
    const { client, skillsInsert } = makeClient(
      { id: USER_ID },
      { account_type: 'talent', headline: 'Existing headline', talent_skills: [{ id: 'skill-1' }] },
    )
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
    expect(skillsInsert).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid payload', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }, FRESH_TALENT).client)
    const res = await POST(makeRequest({ ...VALID_BODY, skills: [] }))
    expect(res.status).toBe(400)
  })

  it('completes onboarding: updates the profile, inserts skills, upserts availability', async () => {
    const { client, profileUpdateEq, skillsInsert } = makeClient({ id: USER_ID }, FRESH_TALENT)
    mockCreateClient.mockResolvedValue(client)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    expect(profileUpdateEq).toHaveBeenCalledWith('id', USER_ID)
    expect(skillsInsert).toHaveBeenCalledWith([
      { profile_id: USER_ID, category: 'dancer', skill: 'Bollywood', proficiency: 'intermediate' },
      { profile_id: USER_ID, category: 'dancer', skill: 'Kathak', proficiency: 'intermediate' },
    ])
    expect(attributesUpsert).toHaveBeenCalledWith(
      { profile_id: USER_ID, available_now: true },
      { onConflict: 'profile_id' },
    )
  })

  it('still succeeds when the availability upsert fails (non-fatal)', async () => {
    attributesUpsert.mockResolvedValue({ error: { code: 'XX000' } })
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }, FRESH_TALENT).client)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
  })
})
