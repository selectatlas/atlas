import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { PATCH } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

type MockApplication = {
  id: string
  job_id: string
  talent_id?: string
  status?: string
  jobs: { hirer_id: string; title?: string | null }
}

function makeClient({
  user,
  application,
  rpcError,
}: {
  user: { id: string } | null
  application?: MockApplication | null
  rpcError?: { code: string } | null
}) {
  const messageInsert = vi.fn().mockResolvedValue({ error: null })
  const rpc = vi.fn().mockResolvedValue({
    data: rpcError ? null : 'thread-1',
    error: rpcError ?? null,
  })
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'messages') {
        return { insert: messageInsert }
      }
      // applications: select().eq().single() and update().eq().select().single()
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: application ?? null,
          error: null,
        }),
      }
    }),
    _messageInsert: messageInsert,
  }
}

const APP_ID = '44444444-4444-4444-8444-444444444444'
const JOB_ID = '33333333-3333-4333-8333-333333333333'
const TALENT_ID = '11111111-1111-4111-8111-111111111111'
const params = Promise.resolve({ id: APP_ID })

function ownedApplication(overrides: Partial<MockApplication> = {}): MockApplication {
  return {
    id: APP_ID,
    job_id: JOB_ID,
    talent_id: TALENT_ID,
    status: 'sent',
    jobs: { hirer_id: 'u1', title: 'West End Revival' },
    ...overrides,
  }
}

describe('PATCH /api/applications/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for a non-uuid application id', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' } }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'app-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, application: ownedApplication() }))
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
      application: ownedApplication({ jobs: { hirer_id: 'other-hirer' } }),
    }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid status', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, application: ownedApplication() }))
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'invalid' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })

  it('emits a shortlisted system card when moving to shortlisted', async () => {
    const client = makeClient({ user: { id: 'u1' }, application: ownedApplication() })
    mockCreateClient.mockResolvedValue(client)
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(client.rpc).toHaveBeenCalledWith('create_or_get_thread_with_origin', {
      other_profile_id: TALENT_ID,
      origin_outreach: null,
      origin_job: JOB_ID,
    })
    expect(client._messageInsert).toHaveBeenCalledWith({
      thread_id: 'thread-1',
      sender_id: 'u1',
      content: 'Shortlisted for West End Revival',
      kind: 'application_shortlisted',
    })
  })

  it('emits a hired system card when moving to hired', async () => {
    const client = makeClient({ user: { id: 'u1' }, application: ownedApplication({ status: 'shortlisted' }) })
    mockCreateClient.mockResolvedValue(client)
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'hired' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(client._messageInsert).toHaveBeenCalledWith({
      thread_id: 'thread-1',
      sender_id: 'u1',
      content: 'Hired for West End Revival',
      kind: 'application_hired',
    })
  })

  it('emits a declined system card when moving to declined', async () => {
    const client = makeClient({ user: { id: 'u1' }, application: ownedApplication({ status: 'viewed' }) })
    mockCreateClient.mockResolvedValue(client)
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'declined' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(client._messageInsert).toHaveBeenCalledWith({
      thread_id: 'thread-1',
      sender_id: 'u1',
      content: 'The role West End Revival went in a different direction this time',
      kind: 'application_declined',
    })
  })

  it('returns 409 when declining a hired applicant', async () => {
    const client = makeClient({ user: { id: 'u1' }, application: ownedApplication({ status: 'hired' }) })
    mockCreateClient.mockResolvedValue(client)
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'declined' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(409)
    expect(client._messageInsert).not.toHaveBeenCalled()
  })

  it('does not emit a card for non-decision statuses', async () => {
    const client = makeClient({ user: { id: 'u1' }, application: ownedApplication() })
    mockCreateClient.mockResolvedValue(client)
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'viewed' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(client.rpc).not.toHaveBeenCalled()
    expect(client._messageInsert).not.toHaveBeenCalled()
  })

  it('does not emit a card when the status is unchanged', async () => {
    const client = makeClient({ user: { id: 'u1' }, application: ownedApplication({ status: 'shortlisted' }) })
    mockCreateClient.mockResolvedValue(client)
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(client._messageInsert).not.toHaveBeenCalled()
  })

  it('still returns 200 when the system card thread cannot be created', async () => {
    const client = makeClient({
      user: { id: 'u1' },
      application: ownedApplication(),
      rpcError: { code: '42501' },
    })
    mockCreateClient.mockResolvedValue(client)
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'hired' }) })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(client._messageInsert).not.toHaveBeenCalled()
  })
})
