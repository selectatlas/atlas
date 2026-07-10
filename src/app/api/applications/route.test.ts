import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function makeClient({
  user,
  accountType,
  job,
  insertError,
}: {
  user: { id: string } | null
  accountType: string | null
  job?: { id: string; status: string } | null
  insertError?: { code: string } | null
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { account_type: accountType } }) }) }),
        }
      }
      if (table === 'jobs') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: job ?? null }) }) }),
        }
      }
      // applications
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: insertError ? null : { id: 'app-1', job_id: 'job-1', talent_id: user?.id, status: 'sent' },
              error: insertError ?? null,
            }),
          }),
        }),
      }
    }),
  }
}

function makeRequest(body: object) {
  return new Request('http://localhost/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/applications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null, accountType: null }))
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as hirer (not talent)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'hirer' }))
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when job does not exist', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: null }))
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when job is closed', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: { id: 'job-1', status: 'closed' } }))
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(409)
  })

  it('returns 201 on successful application', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: { id: 'u1' }, accountType: 'talent', job: { id: 'job-1', status: 'open' } }))
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.application).toBeDefined()
  })

  it('returns 409 when already applied (unique constraint)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      user: { id: 'u1' }, accountType: 'talent',
      job: { id: 'job-1', status: 'open' },
      insertError: { code: '23505' },
    }))
    const res = await POST(makeRequest({ job_id: 'job-1' }))
    expect(res.status).toBe(409)
  })
})
