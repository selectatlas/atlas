import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/platform-admin', () => ({
  requirePlatformAdmin: vi.fn(),
}))

import { GET, PATCH } from './route'
import { requirePlatformAdmin } from '@/lib/platform-admin'

const mockRequirePlatformAdmin = requirePlatformAdmin as ReturnType<typeof vi.fn>

const REPORT_ID = '11111111-1111-4111-8111-111111111111'

function makeService({
  reports = [],
  updateError = null,
}: {
  reports?: Array<Record<string, unknown>>
  updateError?: { code: string } | null
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'reports') {
        return {
          select: () => ({
            order: () => ({
              limit: () => ({
                eq: () => Promise.resolve({ data: reports, error: null }),
                then: undefined,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: updateError ? null : { id: REPORT_ID, status: 'resolved', admin_notes: null, resolved_by: 'admin-1', resolved_at: '2026-01-01' },
                  error: updateError,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles' || table === 'jobs') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('GET /api/admin/reports', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 403 for non-admin', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const res = await GET(new Request('http://localhost/api/admin/reports'))
    expect(res.status).toBe(403)
  })

  it('lists reports for admin', async () => {
    const service = makeService({
      reports: [{
        id: REPORT_ID,
        reporter_id: 'r1',
        reported_profile_id: 'p1',
        reported_job_id: null,
        reason: 'spam',
        details: null,
        status: 'open',
        admin_notes: null,
        resolved_by: null,
        resolved_at: null,
        created_at: '2026-01-01',
      }],
    })

    // Fix chain for GET without status filter
    service.from = vi.fn((table: string) => {
      if (table === 'reports') {
        return {
          select: () => ({
            order: () => ({
              limit: () => Promise.resolve({
                data: [{
                  id: REPORT_ID,
                  reporter_id: 'r1',
                  reported_profile_id: 'p1',
                  reported_job_id: null,
                  reason: 'spam',
                  details: null,
                  status: 'open',
                  admin_notes: null,
                  resolved_by: null,
                  resolved_at: null,
                  created_at: '2026-01-01',
                }],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [{ id: 'r1', full_name: 'Reporter', email: 'r@test.com', account_type: 'hirer' }],
              error: null,
            }),
          }),
        }
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
    })

    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service,
    })

    const res = await GET(new Request('http://localhost/api/admin/reports'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reports).toHaveLength(1)
    expect(body.reports[0].reporter?.full_name).toBe('Reporter')
  })
})

describe('PATCH /api/admin/reports', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects invalid status', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service: makeService({}),
    })

    const res = await PATCH(new Request('http://localhost/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: REPORT_ID, status: 'invalid' }),
    }))
    expect(res.status).toBe(400)
  })
})
