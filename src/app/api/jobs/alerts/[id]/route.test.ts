import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { PATCH, DELETE } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>

const ALERT_ID = 'a1b2c3d4-0000-4000-8000-000000000001'

function makeClient(user: { id: string } | null) {
  const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
  const del = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn(() => ({ update, delete: del })),
    },
    update,
    del,
  }
}

function makeServiceClient(ownerRow: { talent_id: string } | null) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: ownerRow }),
        }),
      }),
    })),
  }
}

function call(handler: typeof PATCH, id: string) {
  return handler(new Request('http://localhost/api/jobs/alerts/x'), { params: Promise.resolve({ id }) })
}

describe('PATCH and DELETE /api/jobs/alerts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null).client)
    mockCreateServiceClient.mockReturnValue(makeServiceClient(null))
    expect((await call(PATCH, ALERT_ID)).status).toBe(401)
    expect((await call(DELETE, ALERT_ID)).status).toBe(401)
  })

  it('returns 404 for a malformed or unknown id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }).client)
    mockCreateServiceClient.mockReturnValue(makeServiceClient(null))
    expect((await call(PATCH, 'not-a-uuid')).status).toBe(404)
    expect((await call(PATCH, ALERT_ID)).status).toBe(404)
  })

  it("returns 403 (never 404) for another talent's alert", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'talent-1' }).client)
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ talent_id: 'someone-else' }))
    expect((await call(PATCH, ALERT_ID)).status).toBe(403)
    expect((await call(DELETE, ALERT_ID)).status).toBe(403)
  })

  it('marks an owned alert as viewed', async () => {
    const { client, update } = makeClient({ id: 'talent-1' })
    mockCreateClient.mockResolvedValue(client)
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ talent_id: 'talent-1' }))
    const res = await call(PATCH, ALERT_ID)
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ last_viewed_at: expect.any(String) }))
  })

  it('deletes an owned alert', async () => {
    const { client, del } = makeClient({ id: 'talent-1' })
    mockCreateClient.mockResolvedValue(client)
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ talent_id: 'talent-1' }))
    const res = await call(DELETE, ALERT_ID)
    expect(res.status).toBe(200)
    expect(del).toHaveBeenCalled()
  })
})
