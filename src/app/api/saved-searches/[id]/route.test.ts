import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { PATCH, DELETE } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>

const SEARCH_ID = '33333333-3333-4333-8333-333333333333'

function makeUserClient(user: { id: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    })),
  }
}

function makeServiceClient(row: { hirer_id: string } | null) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row }),
        }),
      }),
    })),
  }
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const request = new Request('http://localhost/api/saved-searches/x', { method: 'PATCH' })

describe.each([
  ['PATCH', PATCH],
  ['DELETE', DELETE],
] as const)('%s /api/saved-searches/[id]', (_method, handler) => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for a non-uuid id', async () => {
    mockCreateClient.mockResolvedValue(makeUserClient({ id: 'u1' }))
    mockCreateServiceClient.mockReturnValue(makeServiceClient(null))
    const res = await handler(request, makeParams('not-a-uuid'))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeUserClient(null))
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ hirer_id: 'u1' }))
    const res = await handler(request, makeParams(SEARCH_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the saved search does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeUserClient({ id: 'u1' }))
    mockCreateServiceClient.mockReturnValue(makeServiceClient(null))
    const res = await handler(request, makeParams(SEARCH_ID))
    expect(res.status).toBe(404)
  })

  it('returns 403 when authenticated but not the owner', async () => {
    mockCreateClient.mockResolvedValue(makeUserClient({ id: 'u1' }))
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ hirer_id: 'someone-else' }))
    const res = await handler(request, makeParams(SEARCH_ID))
    expect(res.status).toBe(403)
  })

  it('succeeds for the owner', async () => {
    mockCreateClient.mockResolvedValue(makeUserClient({ id: 'u1' }))
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ hirer_id: 'u1' }))
    const res = await handler(request, makeParams(SEARCH_ID))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })
})
