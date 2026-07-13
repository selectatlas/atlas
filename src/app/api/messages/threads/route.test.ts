import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn() }) }))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function request(body: object) {
  return new Request('http://localhost/api/messages/threads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/messages/threads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires authentication', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    expect((await POST(request({ talent_id: 'talent-1' }))).status).toBe(401)
  })

  it('creates the conversation through the atomic database function', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'thread-1', error: null })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'hirer-1' } } }) },
      rpc,
    })

    const response = await POST(request({ talent_id: 'talent-1' }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ thread_id: 'thread-1' })
    expect(rpc).toHaveBeenCalledWith('create_or_get_thread', { other_profile_id: 'talent-1' })
  })

  it('maps database authorization failures to 403', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'talent-1' } } }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }),
    })

    expect((await POST(request({ talent_id: 'talent-2' }))).status).toBe(403)
  })
})
