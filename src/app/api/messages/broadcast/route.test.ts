import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/access', () => ({ getAuthenticatedCaller: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { getAuthenticatedCaller } from '@/lib/access'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockGetCaller = getAuthenticatedCaller as ReturnType<typeof vi.fn>
const mockEnforceRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

const TALENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TALENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function makeSupabase({
  shortlist = [TALENT_A, TALENT_B],
  rpcFails = false,
  insertFailsFor = [] as string[],
}: {
  shortlist?: string[]
  rpcFails?: boolean
  insertFailsFor?: string[]
} = {}) {
  let lastThreadForTalent: string | null = null
  const insert = vi.fn((row: { thread_id: string }) => {
    const fails = insertFailsFor.includes(row.thread_id)
    return Promise.resolve({ error: fails ? { code: 'XX000' } : null })
  })
  const rpc = vi.fn((_fn: string, args: { other_profile_id: string }) => {
    lastThreadForTalent = `thread-${args.other_profile_id}`
    if (rpcFails) return Promise.resolve({ data: null, error: { code: '42501' } })
    return Promise.resolve({ data: lastThreadForTalent, error: null })
  })
  return {
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'shortlists') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: shortlist.map(talent_id => ({ talent_id })) }),
            }),
          }),
        }
      }
      // messages
      return { insert }
    }),
    _insert: insert,
    _rpc: rpc,
  }
}

function callerOk(supabase: ReturnType<typeof makeSupabase>, canHirer = true) {
  return {
    ok: true,
    supabase,
    user: { id: 'hirer-1' },
    access: { canHirer },
  }
}

function makeRequest(content = 'We are casting for a new campaign!') {
  return new Request('http://localhost/api/messages/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

describe('POST /api/messages/broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCaller.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-hirer caller', async () => {
    mockGetCaller.mockResolvedValue(callerOk(makeSupabase(), false))
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('rejects empty content', async () => {
    mockGetCaller.mockResolvedValue(callerOk(makeSupabase()))
    const res = await POST(makeRequest('   '))
    expect(res.status).toBe(400)
  })

  it('returns 400 when nothing is shortlisted', async () => {
    mockGetCaller.mockResolvedValue(callerOk(makeSupabase({ shortlist: [] })))
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockGetCaller.mockResolvedValue(callerOk(makeSupabase()))
    mockEnforceRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
  })

  it('fans one message out to every shortlisted talent', async () => {
    const supabase = makeSupabase()
    mockGetCaller.mockResolvedValue(callerOk(supabase))
    const res = await POST(makeRequest('Hello all'))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toEqual({
      sent: 2,
      failed: 0,
      total: 2,
      thread_ids: [`thread-${TALENT_A}`, `thread-${TALENT_B}`],
    })
    expect(supabase._rpc).toHaveBeenCalledTimes(2)
    expect(supabase._insert).toHaveBeenCalledTimes(2)
    expect(supabase._insert).toHaveBeenCalledWith({
      thread_id: `thread-${TALENT_A}`,
      sender_id: 'hirer-1',
      content: 'Hello all',
    })
  })

  it('reports partial failure without aborting the rest', async () => {
    const supabase = makeSupabase({ insertFailsFor: [`thread-${TALENT_A}`] })
    mockGetCaller.mockResolvedValue(callerOk(supabase))
    const res = await POST(makeRequest())
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.sent).toBe(1)
    expect(data.failed).toBe(1)
    expect(data.total).toBe(2)
  })

  it('returns 500 when every recipient fails', async () => {
    const supabase = makeSupabase({ rpcFails: true })
    mockGetCaller.mockResolvedValue(callerOk(supabase))
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })
})
