import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/thread-lookup', () => ({ findThreadWithOther: vi.fn() }))

import { GET, PATCH } from './route'
import { createClient } from '@/lib/supabase/server'
import { findThreadWithOther } from '@/lib/thread-lookup'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockFindThread = findThreadWithOther as ReturnType<typeof vi.fn>

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

  it('advances new applications to viewed when the hirer opens the job', async () => {
    const appUpdateEqStatus = vi.fn().mockResolvedValue({ error: null })
    const appUpdateEqJob = vi.fn(() => ({ eq: appUpdateEqStatus }))
    const applicationsUpdate = vi.fn(() => ({ eq: appUpdateEqJob }))
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: JOB_ID, hirer_id: 'user-1' }, error: null }),
          }
        }
        return {
          update: applicationsUpdate,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [] }) })),
          })),
        }
      }),
    }
    mockCreateClient.mockResolvedValue(client)
    const res = await GET(new Request('http://localhost'), { params })
    expect(res.status).toBe(200)
    expect(applicationsUpdate).toHaveBeenCalledWith({ status: 'viewed' })
    expect(appUpdateEqJob).toHaveBeenCalledWith('job_id', JOB_ID)
    expect(appUpdateEqStatus).toHaveBeenCalledWith('status', 'sent')
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

  it('drops a job_closed card into existing threads with pending applicants on close', async () => {
    const messagesInsert = vi.fn().mockResolvedValue({ error: null })
    const jobsSingle = vi.fn().mockResolvedValue({
      data: { hirer_id: 'user-1', title: 'West End Revival', status: 'open' },
      error: null,
    })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: jobsSingle,
          }
        }
        if (table === 'messages') return { insert: messagesInsert }
        // applications: select('talent_id').eq('job_id', id).in('status', [...])
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [{ talent_id: 'talent-1' }, { talent_id: 'talent-2' }] }),
            })),
          })),
        }
      }),
    }
    mockCreateClient.mockResolvedValue(client)
    // talent-1 has an existing thread; talent-2 does not.
    mockFindThread.mockImplementation(async (_c: unknown, _me: string, other: string) =>
      other === 'talent-1' ? 'thread-9' : null,
    )
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(messagesInsert).toHaveBeenCalledTimes(1)
    expect(messagesInsert).toHaveBeenCalledWith({
      thread_id: 'thread-9',
      sender_id: 'user-1',
      content: 'West End Revival is no longer accepting applications',
      kind: 'job_closed',
    })
  })
})
