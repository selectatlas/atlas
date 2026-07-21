import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// This route is intentionally public, so there are no 401/403 cases to
// assert: the reduced projection is enforced by the public_talent_profiles
// view (migration 031), covered by pgTAP and the integration suite.

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
import { TALENT_PAGE_SIZE } from '@/lib/talent-discovery'

const mockCreateAnonClient = createAnonClient as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/talent/public${query}`)
}

// Chainable PostgREST query stub resolving to the given rows.
function makeQueryClient(rows: Record<string, unknown>[], error: { code: string } | null = null) {
  const result = { data: rows, error, count: rows.length }
  const query = {
    contains: vi.fn(() => query),
    ilike: vi.fn(() => query),
    or: vi.fn(() => query),
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

describe('GET /api/talent/public', () => {
  it('returns the public talent feed', async () => {
    mockCreateAnonClient.mockReturnValue(
      makeQueryClient([
        {
          id: '20000000-0000-0000-0000-000000000002',
          full_name: 'Visible Talent',
          headline: 'Contemporary dancer',
          categories: ['dancer'],
          skills: ['Ballet', 'Contemporary'],
          created_at: '2026-07-01T00:00:00Z',
        },
      ])
    )

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.talent).toHaveLength(1)
    expect(body.talent[0].full_name).toBe('Visible Talent')
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
    expect(body).toEqual({ error: 'Talent could not be loaded' })
  })

  it('caps a full page and exposes a cursor for the next one', async () => {
    const rows = Array.from({ length: TALENT_PAGE_SIZE + 1 }, (_, index) => ({
      id: `20000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      full_name: `Talent ${index}`,
      created_at: '2026-07-01T00:00:00Z',
    }))
    mockCreateAnonClient.mockReturnValue(makeQueryClient(rows))

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.talent).toHaveLength(TALENT_PAGE_SIZE)
    expect(body.nextCursor).toBeTruthy()
  })
})
