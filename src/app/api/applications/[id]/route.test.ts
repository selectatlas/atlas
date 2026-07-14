import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { PATCH } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function makeClient({
  user,
  application,
}: {
  user: { id: string } | null
  application?: { id: string; job_id: string; jobs: { hirer_id: string } } | null
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: application ?? null,
        error: null,
      }),
    })),
  }
}

const APP_ID = '44444444-4444-4444-8444-444444444444'
const params = Promise.resolve({ id: APP_ID })

describe('PATCH /api/applications/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for a non-uuid application id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' } }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'app-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      user: { id: 'u1' },
      application: { id: APP_ID, job_id: 'job-1', jobs: { hirer_id: 'u1' } },
    }))
    const req = new Request('http://localhost', { method: 'PATCH', body: '{broken' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when application does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, application: null }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when job belongs to another hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      user: { id: 'u1' },
      application: { id: 'app-1', job_id: 'job-1', jobs: { hirer_id: 'other-hirer' } },
    }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid status', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      user: { id: 'u1' },
      application: { id: 'app-1', job_id: 'job-1', jobs: { hirer_id: 'u1' } },
    }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'invalid' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })
})
