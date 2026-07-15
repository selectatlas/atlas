import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/platform-admin', () => ({
  requirePlatformAdmin: vi.fn(),
}))

vi.mock('@/lib/job-embedding', () => ({
  embedJob: vi.fn().mockResolvedValue({ status: 'complete' }),
}))

import { POST } from './route'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { embedJob } from '@/lib/job-embedding'

const mockRequirePlatformAdmin = requirePlatformAdmin as ReturnType<typeof vi.fn>
const mockEmbedJob = embedJob as ReturnType<typeof vi.fn>

const HIRER_ID = '22222222-2222-4222-8222-222222222222'

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    hirer_id: HIRER_ID,
    title: 'Music video dancers',
    description: 'Need 4 Bollywood dancers for a 2-day shoot in London.',
    category: 'dancer',
    location: 'London, UK',
    skills_required: ['Bollywood'],
    budget: '£500/day',
    ...overrides,
  }
}

function makeService({
  hirer = { id: HIRER_ID, account_type: 'hirer', suspended_at: null },
  insertError = null,
}: {
  hirer?: { id: string; account_type: string; suspended_at: string | null } | null
  insertError?: { code: string } | null
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: hirer, error: null }),
            }),
          }),
        }
      }
      if (table === 'jobs') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: insertError ? null : {
                  id: '33333333-3333-4333-8333-333333333333',
                  hirer_id: HIRER_ID,
                  title: 'Music video dancers',
                  description: 'Need 4 Bollywood dancers for a 2-day shoot in London.',
                  category: 'dancer',
                  skills_required: ['Bollywood'],
                  location: 'London, UK',
                  budget: '£500/day',
                  status: 'open',
                },
                error: insertError,
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('POST /api/admin/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedJob.mockResolvedValue({ status: 'complete' })
  })

  it('returns 403 for non-admin', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    })

    const res = await POST(new Request('http://localhost/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    }))

    expect(res.status).toBe(403)
  })

  it('creates a job for a hirer', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service: makeService(),
    })

    const res = await POST(new Request('http://localhost/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.job.title).toBe('Music video dancers')
    expect(body.job.embedding_status).toBe('complete')
  })

  it('rejects non-hirer accounts', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service: makeService({ hirer: { id: HIRER_ID, account_type: 'talent', suspended_at: null } }),
    })

    const res = await POST(new Request('http://localhost/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not a hirer/i)
  })
})
