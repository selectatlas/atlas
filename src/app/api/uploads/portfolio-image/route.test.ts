import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST, DELETE } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const HTML_BYTES = new TextEncoder().encode('<!doctype html><script>alert(1)</script>')

function makeStorage() {
  return {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } })),
  }
}

function makeClient(user: { id: string } | null, storage = makeStorage()) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    storage: { from: vi.fn(() => storage) },
    _storage: storage,
  }
}

function makeRequest(file?: File | string) {
  const form = new FormData()
  if (file !== undefined) form.append('file', file)
  return new Request('http://localhost/api/uploads/portfolio-image', { method: 'POST', body: form })
}

function pngFile(name = 'shot.png') {
  return new File([PNG_BYTES], name, { type: 'image/png' })
}

describe('POST /api/uploads/portfolio-image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    const res = await POST(makeRequest(pngFile()))
    expect(res.status).toBe(401)
  })

  it('uploads a verified image under the caller-owned folder', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(pngFile()))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.path).toMatch(/^user-1\/[0-9a-f-]{36}\.png$/)
    expect(data.url).toBe(`https://cdn.example/${data.path}`)
    expect(client._storage.upload).toHaveBeenCalledTimes(1)
  })

  // The profile-photo route wipes the folder after upload because an avatar is
  // singular. Doing that here would delete the rest of the portfolio.
  it('never removes previously uploaded portfolio files', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)
    await POST(makeRequest(pngFile()))
    expect(client._storage.remove).not.toHaveBeenCalled()
    expect(client._storage.list).not.toHaveBeenCalled()
  })

  it('rejects a non-image masquerading as an image', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest(new File([HTML_BYTES], 'evil.png', { type: 'image/png' })))
    expect(res.status).toBe(400)
    expect(client._storage.upload).not.toHaveBeenCalled()
  })

  it('rejects a disallowed declared type', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }))
    const res = await POST(makeRequest(new File([PNG_BYTES], 'x.gif', { type: 'image/gif' })))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no file is attached', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }))
    expect((await POST(makeRequest())).status).toBe(400)
  })

  it('passes the rate limit response through', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many' }, { status: 429 }))
    const res = await POST(makeRequest(pngFile()))
    expect(res.status).toBe(429)
  })

  it('returns 500 when storage rejects the upload', async () => {
    const storage = makeStorage()
    storage.upload.mockResolvedValue({ error: { message: 'boom' } })
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, storage))
    const res = await POST(makeRequest(pngFile()))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/uploads/portfolio-image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function deleteRequest(path?: string) {
    const url = new URL('http://localhost/api/uploads/portfolio-image')
    if (path !== undefined) url.searchParams.set('path', path)
    return new Request(url, { method: 'DELETE' })
  }

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    expect((await DELETE(deleteRequest('user-1/a.png'))).status).toBe(401)
  })

  it('returns 400 without a path', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }))
    expect((await DELETE(deleteRequest())).status).toBe(400)
  })

  it("refuses to delete another user's file", async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)
    const res = await DELETE(deleteRequest('user-2/secret.png'))
    expect(res.status).toBe(403)
    expect(client._storage.remove).not.toHaveBeenCalled()
  })

  it('removes the caller’s own file', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)
    const res = await DELETE(deleteRequest('user-1/a.png'))
    expect(res.status).toBe(200)
    expect(client._storage.remove).toHaveBeenCalledWith(['user-1/a.png'])
  })
})
