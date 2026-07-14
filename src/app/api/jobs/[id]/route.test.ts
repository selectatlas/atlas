import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET, PATCH } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function makeClient(user: { id: string } | null, job: { id: string; hirer_id: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: job, error: null }),
    })),
  }
}

const JOB_ID = '33333333-3333-4333-8333-333333333333'
const params = Promise.resolve({ id: JOB_ID })

describe('GET /api/jobs/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for a non-uuid job id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, null))
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'job-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await GET(new Request('http://localhost'), { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when job does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, null))
    const res = await GET(new Request('http://localhost'), { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when job belongs to another hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, { id: JOB_ID, hirer_id: 'other-user' }))
    const res = await GET(new Request('http://localhost'), { params })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/jobs/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when job belongs to another hirer', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, { id: JOB_ID, hirer_id: 'other-user' }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid status value', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, { id: JOB_ID, hirer_id: 'user-1' }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'invalid' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, { id: JOB_ID, hirer_id: 'user-1' }))
    const req = new Request('http://localhost', { method: 'PATCH', body: '{broken' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })
})
