import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  parseBudgetRange,
  encodeCursor,
  decodeCursor,
  sanitizeSearchTerm,
  parseDiscoverParams,
  cursorPredicate,
  fetchDiscoverJobs,
  type DiscoverFilters,
} from './job-discovery'

const JOB_ID = 'a1b2c3d4-0000-4000-8000-000000000001'

describe('parseBudgetRange', () => {
  it('parses a single rate', () => {
    expect(parseBudgetRange('£300 per day')).toEqual({ min: 300, max: 300 })
  })

  it('parses a range and orders bounds', () => {
    expect(parseBudgetRange('£250 - £500')).toEqual({ min: 250, max: 500 })
  })

  it('handles thousands separators', () => {
    expect(parseBudgetRange('£1,500 total')).toEqual({ min: 1500, max: 1500 })
  })

  it('returns nulls for missing or numberless budgets', () => {
    expect(parseBudgetRange(null)).toEqual({ min: null, max: null })
    expect(parseBudgetRange('Rate on application')).toEqual({ min: null, max: null })
  })

  it('ignores absurdly long numbers instead of overflowing', () => {
    expect(parseBudgetRange('9999999999999 or £400')).toEqual({ min: 400, max: 400 })
  })
})

describe('cursor encode/decode', () => {
  it('round-trips a newest cursor', () => {
    const cursor = { v: '2026-07-17T10:00:00+00:00', id: JOB_ID }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('round-trips numeric and null sort values', () => {
    expect(decodeCursor(encodeCursor({ v: 450, id: JOB_ID }))).toEqual({ v: 450, id: JOB_ID })
    expect(decodeCursor(encodeCursor({ v: null, id: JOB_ID }))).toEqual({ v: null, id: JOB_ID })
  })

  it('rejects garbage, malformed ids, and injection attempts', () => {
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor('not-base64!')).toBeNull()
    expect(decodeCursor(Buffer.from('{"v":1,"id":"nope"}').toString('base64url'))).toBeNull()
    // A quote inside v could escape the PostgREST filter string
    expect(
      decodeCursor(Buffer.from(JSON.stringify({ v: '2026",id.gt.0', id: JOB_ID })).toString('base64url')),
    ).toBeNull()
  })
})

describe('sanitizeSearchTerm', () => {
  it('strips PostgREST metacharacters and wildcards', () => {
    expect(sanitizeSearchTerm('hip,hop(dancer)"%_')).toBe('hip hop dancer')
  })

  it('collapses whitespace and caps length', () => {
    expect(sanitizeSearchTerm('  a   b  ')).toBe('a b')
    expect(sanitizeSearchTerm('x'.repeat(300)).length).toBe(100)
  })
})

describe('parseDiscoverParams', () => {
  it('applies defaults for an empty query string', () => {
    const result = parseDiscoverParams(new URLSearchParams())
    expect(result).toMatchObject({
      ok: true,
      cursor: null,
      filters: { categories: [], search: '', workType: 'all', location: null, budgetBand: 'any', sort: 'newest' },
    })
  })

  it('accepts a full valid parameter set', () => {
    const params = new URLSearchParams({
      category: 'dancer', work: 'remote', rate: 'over500', sort: 'rate_high', loc: 'London', q: 'video',
    })
    const result = parseDiscoverParams(params)
    expect(result).toMatchObject({
      ok: true,
      filters: { categories: ['dancer'], workType: 'remote', budgetBand: 'over500', sort: 'rate_high', location: 'London', search: 'video' },
    })
  })

  it('accepts a comma-separated category list for multi-category talent', () => {
    const result = parseDiscoverParams(new URLSearchParams({ category: 'dancer,actor' }))
    expect(result).toMatchObject({ ok: true, filters: { categories: ['dancer', 'actor'] } })
    expect(parseDiscoverParams(new URLSearchParams({ category: 'dancer,astronaut' })).ok).toBe(false)
  })

  it('accepts the relevance sort', () => {
    expect(parseDiscoverParams(new URLSearchParams({ sort: 'relevance', q: 'ballet' }))).toMatchObject({
      ok: true,
      filters: { sort: 'relevance', search: 'ballet' },
    })
  })

  it('parses the count-only flag', () => {
    expect(parseDiscoverParams(new URLSearchParams())).toMatchObject({ ok: true, countOnly: false })
    expect(parseDiscoverParams(new URLSearchParams({ count: '1' }))).toMatchObject({ ok: true, countOnly: true })
  })

  it('rejects unknown enum values and invalid cursors', () => {
    expect(parseDiscoverParams(new URLSearchParams({ category: 'astronaut' })).ok).toBe(false)
    expect(parseDiscoverParams(new URLSearchParams({ work: 'moon' })).ok).toBe(false)
    expect(parseDiscoverParams(new URLSearchParams({ rate: 'free' })).ok).toBe(false)
    expect(parseDiscoverParams(new URLSearchParams({ sort: 'random' })).ok).toBe(false)
    expect(parseDiscoverParams(new URLSearchParams({ cursor: '!!!' })).ok).toBe(false)
  })
})

describe('cursorPredicate', () => {
  it('continues a newest scan on (created_at, id)', () => {
    expect(cursorPredicate('newest', { v: '2026-07-17T10:00:00+00:00', id: JOB_ID })).toBe(
      `created_at.lt."2026-07-17T10:00:00+00:00",and(created_at.eq."2026-07-17T10:00:00+00:00",id.lt.${JOB_ID})`,
    )
  })

  it('includes the trailing null block on rate sorts', () => {
    expect(cursorPredicate('rate_high', { v: 500, id: JOB_ID })).toBe(
      `budget_max.lt.500,and(budget_max.eq.500,id.lt.${JOB_ID}),budget_max.is.null`,
    )
    expect(cursorPredicate('rate_low', { v: 250, id: JOB_ID })).toBe(
      `budget_min.gt.250,and(budget_min.eq.250,id.lt.${JOB_ID}),budget_min.is.null`,
    )
  })

  it('scans only the null block once the cursor is inside it', () => {
    expect(cursorPredicate('rate_high', { v: null, id: JOB_ID })).toBe(
      `and(budget_max.is.null,id.lt.${JOB_ID})`,
    )
  })
})

describe('fetchDiscoverJobs public source', () => {
  const FILTERS: DiscoverFilters = {
    categories: [],
    search: '',
    workType: 'all',
    location: null,
    budgetBand: 'any',
    sort: 'newest',
  }

  function makeClient(rows: Record<string, unknown>[]) {
    const result = { data: rows, error: null, count: rows.length }
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
    const select = vi.fn((...args: unknown[]) => (void args, query))
    const from = vi.fn(() => ({ select }))
    return { client: { from } as unknown as SupabaseClient, from, select, query }
  }

  it('queries the public_open_jobs view without the profiles embed', async () => {
    const { client, from, select } = makeClient([])
    await fetchDiscoverJobs(client, FILTERS, { cursor: null, source: 'public' })
    expect(from).toHaveBeenCalledWith('public_open_jobs')
    const columns = select.mock.calls[0][0] as string
    expect(columns).not.toContain('profiles')
    expect(columns).toContain('hirer_name')
    expect(columns).not.toContain('search_tsv')
  })

  it('skips the status/removed filters the view already enforces', async () => {
    const { client, query } = makeClient([])
    await fetchDiscoverJobs(client, FILTERS, { cursor: null, source: 'public' })
    expect(query.eq).not.toHaveBeenCalledWith('status', 'open')
    expect(query.is).not.toHaveBeenCalledWith('removed_at', null)
  })

  it('normalizes hirer_name into the JobFeedItem hirer shape', async () => {
    const { client } = makeClient([
      { id: JOB_ID, title: 'Open role', created_at: '2026-07-01T00:00:00Z', hirer_name: 'Riverside' },
      { id: JOB_ID.replace('1', '2'), title: 'Anon role', created_at: '2026-07-01T00:00:00Z', hirer_name: null },
    ])
    const result = await fetchDiscoverJobs(client, FILTERS, { cursor: null, source: 'public' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.page.jobs[0].hirer).toEqual({ full_name: 'Riverside' })
    expect(result.page.jobs[1].hirer).toBeNull()
  })

  it('still queries jobs directly for the app source', async () => {
    const { client, from, query } = makeClient([])
    await fetchDiscoverJobs(client, FILTERS, { cursor: null })
    expect(from).toHaveBeenCalledWith('jobs')
    expect(query.eq).toHaveBeenCalledWith('status', 'open')
    expect(query.is).toHaveBeenCalledWith('removed_at', null)
  })
})
