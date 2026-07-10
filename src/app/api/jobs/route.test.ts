import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase/server and openai before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(() => ({
    from: () => ({ upsert: vi.fn().mockResolvedValue({}) }),
  })),
}))

vi.mock('@/lib/openai', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

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

function makeRequest(body: object) {
  return new Request('http://localhost/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  beforeEach(() => vi.clearAllMocks())

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

  it('returns 201 and job when hirer posts valid job', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.job).toBeDefined()
  })

  it('returns 400 when required fields are missing', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'user-1' }, 'hirer'))
    const res = await POST(makeRequest({ title: '', description: '', category: 'dancer', location: '' }))
    expect(res.status).toBe(400)
  })
})
