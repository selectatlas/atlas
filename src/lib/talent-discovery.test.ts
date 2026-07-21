import { describe, it, expect, vi } from 'vitest'
import { encodeCursor } from '@/lib/job-discovery'
import {
  parsePublicTalentParams,
  fetchPublicTalent,
  TALENT_PAGE_SIZE,
  type PublicTalentRow,
} from './talent-discovery'

function params(query: string) {
  return new URLSearchParams(query)
}

function makeRow(overrides: Partial<PublicTalentRow> = {}): PublicTalentRow {
  return {
    id: '20000000-0000-0000-0000-000000000002',
    full_name: 'Visible Talent',
    avatar_url: null,
    headline: 'Contemporary dancer',
    city: 'London',
    country: 'UK',
    rates: '£300 per day',
    availability: 'available_now',
    verified_at: null,
    created_at: '2026-07-01T00:00:00Z',
    categories: ['dancer'],
    skills: ['Ballet', 'Contemporary'],
    ...overrides,
  }
}

// Chainable PostgREST query stub resolving to the given rows.
function makeQueryClient(rows: PublicTalentRow[], error: { code: string } | null = null) {
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
    client: { from: vi.fn(() => ({ select: vi.fn(() => query) })) },
    query,
  }
}

describe('parsePublicTalentParams', () => {
  it('accepts empty params with open filters', () => {
    const parsed = parsePublicTalentParams(params(''))
    expect(parsed).toEqual({ ok: true, filters: { category: null, search: '' }, cursor: null })
  })

  it('accepts a valid category and sanitizes the search term', () => {
    const parsed = parsePublicTalentParams(params('category=dancer&q=ballet%25()'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.filters.category).toBe('dancer')
    expect(parsed.filters.search).toBe('ballet')
  })

  it('rejects an unknown category', () => {
    const parsed = parsePublicTalentParams(params('category=plumber'))
    expect(parsed.ok).toBe(false)
  })

  it('rejects a malformed cursor', () => {
    const parsed = parsePublicTalentParams(params('cursor=not-a-cursor'))
    expect(parsed.ok).toBe(false)
  })

  it('round-trips a valid cursor', () => {
    const cursor = encodeCursor({ v: '2026-07-01T00:00:00Z', id: '20000000-0000-0000-0000-000000000002' })
    const parsed = parsePublicTalentParams(params(`cursor=${cursor}`))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.cursor).toEqual({ v: '2026-07-01T00:00:00Z', id: '20000000-0000-0000-0000-000000000002' })
  })
})

describe('fetchPublicTalent', () => {
  it('returns a page with a total on the first fetch', async () => {
    const { client } = makeQueryClient([makeRow()])
    const result = await fetchPublicTalent(
      client as never,
      { category: null, search: '' },
      null,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.page.talent).toHaveLength(1)
    expect(result.page.total).toBe(1)
    expect(result.page.nextCursor).toBeNull()
  })

  it('applies category and search filters', async () => {
    const { client, query } = makeQueryClient([makeRow()])
    await fetchPublicTalent(client as never, { category: 'dancer', search: 'ballet' }, null)
    expect(query.contains).toHaveBeenCalledWith('categories', ['dancer'])
    expect(query.ilike).toHaveBeenCalledWith('search_text', '%ballet%')
  })

  it('caps a full page and exposes a cursor for the next one', async () => {
    const rows = Array.from({ length: TALENT_PAGE_SIZE + 1 }, (_, index) =>
      makeRow({ id: `20000000-0000-0000-0000-${String(index).padStart(12, '0')}` }),
    )
    const { client } = makeQueryClient(rows)
    const result = await fetchPublicTalent(client as never, { category: null, search: '' }, null)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.page.talent).toHaveLength(TALENT_PAGE_SIZE)
    expect(result.page.nextCursor).toBeTruthy()
  })

  it('continues past a cursor without recomputing the total', async () => {
    const { client, query } = makeQueryClient([makeRow()])
    const cursor = { v: '2026-07-01T00:00:00Z', id: '20000000-0000-0000-0000-000000000002' }
    const result = await fetchPublicTalent(client as never, { category: null, search: '' }, cursor)
    expect(query.or).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.page.total).toBeNull()
  })

  it('reports failure when the query errors', async () => {
    const { client } = makeQueryClient([], { code: 'XX000' })
    const result = await fetchPublicTalent(client as never, { category: null, search: '' }, null)
    expect(result.ok).toBe(false)
  })
})
