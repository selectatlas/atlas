import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const HTML_BYTES = new TextEncoder().encode('<!doctype html><script>alert(1)</script>')

function makeStorage({ existingFiles = [] as Array<{ name: string }> } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  const list = vi.fn().mockResolvedValue({ data: existingFiles })
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } }))
  return { upload, remove, list, getPublicUrl }
}

function makeClient(user: { id: string } | null, storage = makeStorage()) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    storage: { from: vi.fn(() => storage) },
    _storage: storage,
  }
}

function makeRequest(parts: { bucket?: string; file?: File | string }) {
  const form = new FormData()
  if (parts.bucket !== undefined) form.append('bucket', parts.bucket)
  if (parts.file !== undefined) form.append('file', parts.file)
  return new Request('http://localhost/api/uploads/profile-photo', {
    method: 'POST',
    body: form,
  })
}

function pngFile(bytes: Uint8Array = PNG_BYTES, type = 'image/png', name = 'photo.png') {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return new File([copy.buffer], name, { type })
}

describe('POST /api/uploads/profile-photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null))
    const res = await POST(makeRequest({ bucket: 'avatars', file: pngFile() }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid bucket', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await POST(makeRequest({ bucket: 'private-bucket', file: pngFile() }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the file is missing', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await POST(makeRequest({ bucket: 'avatars' }))
    expect(res.status).toBe(400)
  })

  it('rejects non-image content declared as an image (polyglot)', async () => {
    const client = makeClient({ id: 'u1' })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ bucket: 'avatars', file: pngFile(HTML_BYTES, 'image/png', 'evil.png') }))
    expect(res.status).toBe(400)
    expect(client._storage.upload).not.toHaveBeenCalled()
  })

  it('rejects content that does not match its declared type', async () => {
    const client = makeClient({ id: 'u1' })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ bucket: 'avatars', file: pngFile(PNG_BYTES, 'image/jpeg', 'renamed.jpg') }))
    expect(res.status).toBe(400)
    expect(client._storage.upload).not.toHaveBeenCalled()
  })

  it('rejects oversized files with 413', async () => {
    const client = makeClient({ id: 'u1' })
    mockCreateClient.mockResolvedValue(client)
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1)
    oversized.set(PNG_BYTES)
    const res = await POST(makeRequest({ bucket: 'avatars', file: pngFile(oversized) }))
    expect(res.status).toBe(413)
    expect(client._storage.upload).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest({ bucket: 'avatars', file: pngFile() }))
    expect(res.status).toBe(429)
  })

  it('uploads a valid image into the caller-owned folder and returns its URL', async () => {
    const client = makeClient({ id: 'u1' })
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ bucket: 'avatars', file: pngFile() }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.url).toMatch(/^https:\/\/cdn\.example\/u1\//)
    expect(data.path).toMatch(/^u1\/[0-9a-f-]+\.png$/)
    const uploadedPath = client._storage.upload.mock.calls[0][0] as string
    expect(uploadedPath.startsWith('u1/')).toBe(true)
  })

  it('removes previously uploaded files after a successful replacement', async () => {
    const storage = makeStorage({ existingFiles: [{ name: 'old-photo.jpg' }] })
    const client = makeClient({ id: 'u1' }, storage)
    mockCreateClient.mockResolvedValue(client)
    const res = await POST(makeRequest({ bucket: 'avatars', file: pngFile() }))
    expect(res.status).toBe(201)
    expect(storage.remove).toHaveBeenCalledWith(['u1/old-photo.jpg'])
  })
})
