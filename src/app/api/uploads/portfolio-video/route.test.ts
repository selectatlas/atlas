import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { MAX_VIDEO_BYTES } from '@/lib/video-verification'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const ascii = (text: string) => [...text].map(c => c.charCodeAt(0))
// ISO base media header: size box, then "ftyp", then the major brand.
const MP4_BYTES = new Uint8Array([0, 0, 0, 0x20, ...ascii('ftyp'), ...ascii('isom'), 0, 0])
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])

function makeStorage() {
  return {
    upload: vi.fn().mockResolvedValue({ error: null }),
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
  return new Request('http://localhost/api/uploads/portfolio-video', {
    method: 'POST',
    body: form,
  })
}

function mp4File(name = 'reel.mp4', type = 'video/mp4') {
  return new File([MP4_BYTES], name, { type })
}

describe('POST /api/uploads/portfolio-video', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    const res = await POST(makeRequest(mp4File()))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('uploads a verified video under the caller-owned folder', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)

    const res = await POST(makeRequest(mp4File()))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.path).toMatch(/^user-1\/[0-9a-f-]{36}\.mp4$/)
    expect(body.url).toBe(`https://cdn.example/${body.path}`)
    expect(client._storage.upload).toHaveBeenCalledWith(
      body.path,
      expect.any(Uint8Array),
      { contentType: 'video/mp4', upsert: false }
    )
  })

  it('never writes outside the caller-owned folder, whatever the filename', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)

    const res = await POST(makeRequest(mp4File('../../user-2/evil.mp4')))

    expect(res.status).toBe(201)
    const { path } = await res.json()
    expect(path.startsWith('user-1/')).toBe(true)
    expect(path).not.toContain('..')
  })

  it('rejects a non-video whose declared type claims otherwise', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }))
    const png = new File([PNG_BYTES], 'evil.mp4', { type: 'video/mp4' })

    const res = await POST(makeRequest(png))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/not a supported video/i)
  })

  it('rejects container types the browser cannot play natively', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }))
    const res = await POST(makeRequest(mp4File('clip.avi', 'video/x-msvideo')))
    expect(res.status).toBe(400)
  })

  it('rejects an oversized file before buffering it', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)

    // A real Request re-encodes its FormData, which rebuilds the File and
    // discards any faked size - so drive the route through the only input it
    // actually touches. arrayBuffer() throws to prove the guard rejects the
    // upload without ever buffering 100MB into memory.
    const huge = mp4File()
    Object.defineProperty(huge, 'size', { value: MAX_VIDEO_BYTES + 1 })
    huge.arrayBuffer = () => {
      throw new Error('oversized file must be rejected before buffering')
    }
    const form = new FormData()
    form.append('file', huge)
    const request = { formData: async () => form } as unknown as Request

    const res = await POST(request)

    expect(res.status).toBe(413)
    expect(client._storage.upload).not.toHaveBeenCalled()
  })

  it('requires a file part', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }))
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('file is required')
  })

  it('honours the rate limiter before touching storage', async () => {
    const client = makeClient({ id: 'user-1' })
    mockCreateClient.mockResolvedValue(client)
    mockEnforceRateLimit.mockResolvedValue(
      Response.json({ error: 'Too many requests' }, { status: 429 })
    )

    const res = await POST(makeRequest(mp4File()))

    expect(res.status).toBe(429)
    expect(client._storage.upload).not.toHaveBeenCalled()
  })

  it('returns a generic message when storage fails, leaking no internals', async () => {
    const storage = makeStorage()
    storage.upload.mockResolvedValue({ error: { message: 'bucket "portfolio" row-level security' } })
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, storage))

    const res = await POST(makeRequest(mp4File()))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Upload failed' })
  })
})
