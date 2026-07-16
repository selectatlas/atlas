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

function makeClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  }
}

function makeServiceClient(deleteError: { message: string } | null = null) {
  const deleteUser = vi.fn().mockResolvedValue({ error: deleteError })
  const remove = vi.fn().mockResolvedValue({ error: null })
  return {
    auth: { admin: { deleteUser } },
    storage: {
      from: vi.fn(() => ({
        // First page has one file; after deletion the re-list is empty.
        list: vi.fn().mockResolvedValueOnce({ data: [{ name: 'photo.png' }] }).mockResolvedValue({ data: [] }),
        remove,
      })),
    },
    _deleteUser: deleteUser,
    _remove: remove,
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
    mockCreateServiceClient.mockReturnValue(makeServiceClient())
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    expect((await POST(makeRequest({ confirm: 'delete my account' }))).status).toBe(401)
  })

  it('requires the exact confirmation phrase', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    const service = makeServiceClient()
    mockCreateServiceClient.mockReturnValue(service)

    expect((await POST(makeRequest({}))).status).toBe(400)
    expect((await POST(makeRequest({ confirm: 'yes' }))).status).toBe(400)
    expect((await POST(makeRequest({ confirm: 'DELETE MY ACCOUNT' }))).status).toBe(400)
    expect((await POST(makeRequest('{broken'))).status).toBe(400)
    expect(service._deleteUser).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited without deleting anything', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    const service = makeServiceClient()
    mockCreateServiceClient.mockReturnValue(service)
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))

    expect((await POST(makeRequest({ confirm: 'delete my account' }))).status).toBe(429)
    expect(service._deleteUser).not.toHaveBeenCalled()
  })

  it('removes storage files and deletes the auth user', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    const service = makeServiceClient()
    mockCreateServiceClient.mockReturnValue(service)

    const res = await POST(makeRequest({ confirm: 'delete my account' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ deleted: true })
    expect(service._deleteUser).toHaveBeenCalledWith(USER_ID)
    expect(service._remove).toHaveBeenCalledWith([`${USER_ID}/photo.png`])
  })

  it('reports failure safely when the deletion errors', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: USER_ID }))
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ message: 'boom' }))

    const res = await POST(makeRequest({ confirm: 'delete my account' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).not.toContain('boom')
  })
})
