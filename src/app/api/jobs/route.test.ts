import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase/server, job embedding, and rate limiting before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    })),
  })),
}))
vi.mock('@/lib/job-embedding', () => ({
  embedJob: vi.fn().mockResolvedValue({ status: 'complete' }),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  enforceAiQuota: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { embedJob } from '@/lib/job-embedding'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockEmbedJob = embedJob as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>
const mockEnforceAiQuota = enforceAiQuota as ReturnType<typeof vi.fn>

function makeClient(user: { id: string } | null, accountType: string | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { account_type: accountType } }),
            }),
          }),
        }
      }
      // jobs table insert
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'job-1', title: 'Test Job' }, error: null }),
          }),
        }),
      }
    }),
  }
}

function makeRequest(body: object | string) {
  return new Request('http://localhost/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBody = {
  title: 'Bollywood dancers needed',
  description: 'Music video shoot in London',
  category: 'dancer',
  skills_required: ['Bollywood'],
  location: 'London',
  budget: '£500/day',
}

describe('POST /api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedJob.mockResolvedValue({ status: 'complete' })
    mockEnforceRateLimit.mockResolvedValue(null)
    mockEnforceAiQuota.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null, null))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as talent (not hirer)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'talent'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 201 and job with embedding status when hirer posts valid job', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.job).toBeDefined()
    expect(data.job.embedding_status).toBe('complete')
    // Embedding is awaited exactly once per created job (idempotent upsert)
    expect(mockEmbedJob).toHaveBeenCalledTimes(1)
  })

  it('reports a failed embedding honestly instead of dropping it', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    mockEmbedJob.mockResolvedValue({ status: 'failed' })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.job.embedding_status).toBe('failed')
  })

  it('returns 400 when required fields are missing', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ title: '', description: '', category: 'dancer', location: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest('{broken'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an oversized title', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, title: 'x'.repeat(201) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid category', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, category: 'astronaut' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for too many skills', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, skills_required: Array(21).fill('skill') }))
    expect(res.status).toBe(400)
  })

  it('returns 413 for an oversized request body', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ ...validBody, description: 'x'.repeat(200_000) }))
    expect(res.status).toBe(413)
  })

  it('returns 429 without creating a job when the AI quota is exhausted', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    mockEnforceAiQuota.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
    expect(mockEmbedJob).not.toHaveBeenCalled()
  })
})
