import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn() }) }))
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
const OTHER_TALENT_ID = '22222222-2222-4222-8222-222222222222'

function request(body: object | string) {
  return new Request('http://localhost/api/messages/threads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/messages/threads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('requires authentication', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    expect((await POST(request({ talent_id: TALENT_ID }))).status).toBe(401)
  })

  it('rejects malformed JSON with 400', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'hirer-1' } } }) },
    })

    expect((await POST(request('{not json'))).status).toBe(400)
  })

  it('rejects a non-uuid talent_id with 400', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'hirer-1' } } }) },
    })

    expect((await POST(request({ talent_id: 'talent-1' }))).status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'hirer-1' } } }) },
    })
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))

    expect((await POST(request({ talent_id: TALENT_ID }))).status).toBe(429)
  })

  it('creates the conversation through the atomic database function', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'thread-1', error: null })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'hirer-1' } } }) },
      rpc,
    })

    const response = await POST(request({ talent_id: TALENT_ID }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ thread_id: 'thread-1' })
    expect(rpc).toHaveBeenCalledWith('create_or_get_thread', { other_profile_id: TALENT_ID })
  })

  it('maps database authorization failures to 403', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'talent-1' } } }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }),
    })

    expect((await POST(request({ talent_id: OTHER_TALENT_ID }))).status).toBe(403)
  })
})
