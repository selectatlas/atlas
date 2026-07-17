import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// This route is intentionally public, so there are no 401/403 cases to
// assert: anon row scoping is enforced by RLS and the public_open_jobs view
// (migration 026), covered by pgTAP and the integration suite.

vi.mock('@/lib/supabase/server', () => ({
  createAnonClient: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('203.0.113.7'),
}))

import { GET } from './route'
import { createAnonClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { DISCOVER_PAGE_SIZE } from '@/lib/job-discovery'

const mockCreateAnonClient = createAnonClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/jobs/public${query}`)
}

// Chainable PostgREST query stub resolving to the given rows.
function makeQueryClient(rows: Record<string, unknown>[], error: { code: string } | null = null) {
  const result = { data: rows, error, count: rows.length }
  const query = {
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    lt: vi.fn(() => query),
    lte: vi.fn(() => query),
    gt: vi.fn(() => query),
    gte: vi.fn(() => query),
    not: vi.fn(() => query),
    or: vi.fn(() => query),
    textSearch: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return {
    from: vi.fn(() => ({ select: vi.fn(() => query) })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnforceRateLimit.mockResolvedValue(null)
})

describe('GET /api/jobs/public', () => {
  it('returns the public feed with normalized hirer names', async () => {
    mockCreateAnonClient.mockReturnValue(
      makeQueryClient([
        {
          id: '40000000-0000-0000-0000-000000000004',
          title: 'Open role',
          category: 'dancer',
          created_at: '2026-07-01T00:00:00Z',
          hirer_name: 'Riverside Studios',
        },
      ])
    )

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0].hirer).toEqual({ full_name: 'Riverside Studios' })
    expect(body.total).toBe(1)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=60')
  })

  it('returns 429 when the IP rate limit denies the request', async () => {
    mockEnforceRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
    )

    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
    expect(mockCreateAnonClient).not.toHaveBeenCalled()
  })

  it('rejects invalid filter params with 400', async () => {
    mockCreateAnonClient.mockReturnValue(makeQueryClient([]))

    const res = await GET(makeRequest('?category=plumber'))
    expect(res.status).toBe(400)
  })

  it('rejects a malformed cursor with 400', async () => {
    mockCreateAnonClient.mockReturnValue(makeQueryClient([]))

    const res = await GET(makeRequest('?cursor=not-a-cursor'))
    expect(res.status).toBe(400)
  })

  it('returns a generic 500 when the query fails', async () => {
    mockCreateAnonClient.mockReturnValue(makeQueryClient([], { code: 'XX000' }))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Jobs could not be loaded' })
  })

  it('caps a full page and exposes a cursor for the next one', async () => {
    const rows = Array.from({ length: DISCOVER_PAGE_SIZE + 1 }, (_, index) => ({
      id: `40000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      title: `Job ${index}`,
      created_at: '2026-07-01T00:00:00Z',
      hirer_name: 'Hirer',
    }))
    mockCreateAnonClient.mockReturnValue(makeQueryClient(rows))

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.jobs).toHaveLength(DISCOVER_PAGE_SIZE)
    expect(body.nextCursor).toBeTruthy()
  })
})
