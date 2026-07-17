import { describe, expect, it } from 'vitest'
import {
  buildSavedSearchHref,
  describeSavedSearch,
  mapSavedSearchRow,
  newMatchesBody,
  parseSavedSearchInput,
  SAVED_SEARCH_NAME_MAX,
  SAVED_SEARCH_QUERY_MAX,
} from '@/lib/saved-searches'

describe('parseSavedSearchInput', () => {
  it('accepts a name plus query', () => {
    const result = parseSavedSearchInput({ name: '  Bollywood dancers  ', query: ' Bollywood dancers in London ' })
    expect(result).toEqual({
      ok: true,
      input: { name: 'Bollywood dancers', query: 'Bollywood dancers in London', filters: {} },
    })
  })

  it('accepts a name plus filters and normalises them', () => {
    const result = parseSavedSearchInput({ name: 'Dancers', filters: { category: 'dancer' } })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.input.filters).toEqual({ category: 'dancer' })
  })

  it('rejects a missing or oversized name', () => {
    expect(parseSavedSearchInput({ query: 'dancers' }).ok).toBe(false)
    expect(parseSavedSearchInput({ name: '   ', query: 'dancers' }).ok).toBe(false)
    expect(parseSavedSearchInput({ name: 'x'.repeat(SAVED_SEARCH_NAME_MAX + 1), query: 'dancers' }).ok).toBe(false)
  })

  it('rejects a non-string or oversized query', () => {
    expect(parseSavedSearchInput({ name: 'Dancers', query: 42 }).ok).toBe(false)
    expect(parseSavedSearchInput({ name: 'Dancers', query: 'x'.repeat(SAVED_SEARCH_QUERY_MAX + 1) }).ok).toBe(false)
  })

  it('rejects unknown filter keys', () => {
    expect(parseSavedSearchInput({ name: 'Dancers', filters: { nope: 'x' } }).ok).toBe(false)
  })

  it('rejects a search with neither query nor filters', () => {
    expect(parseSavedSearchInput({ name: 'Empty' }).ok).toBe(false)
  })
})

describe('mapSavedSearchRow', () => {
  const base = {
    id: 'id-1',
    name: 'Dancers',
    query: 'dancers',
    last_viewed_at: '2026-07-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
  }

  it('maps a row and keeps valid filters', () => {
    const search = mapSavedSearchRow({ ...base, filters: { category: 'dancer' } })
    expect(search.filters).toEqual({ category: 'dancer' })
    expect(search.lastViewedAt).toBe('2026-07-01T00:00:00.000Z')
  })

  it('degrades invalid stored filters to an empty set', () => {
    const search = mapSavedSearchRow({ ...base, filters: { bogus_key: true } })
    expect(search.filters).toEqual({})
  })
})

describe('buildSavedSearchHref', () => {
  it('encodes query and filters into the search URL', () => {
    const href = buildSavedSearchHref({ query: 'dancers in London', filters: { category: 'dancer' } })
    expect(href).toContain('/search?')
    expect(href).toContain('category=dancer')
    expect(href).toContain('q=dancers+in+London')
  })

  it('falls back to /search when nothing is stored', () => {
    expect(buildSavedSearchHref({ query: '', filters: {} })).toBe('/search')
  })
})

describe('describeSavedSearch', () => {
  it('prefers the query text', () => {
    expect(describeSavedSearch({ query: 'dancers', filters: { category: 'dancer' } })).toBe('dancers')
  })

  it('lists filter labels when there is no query', () => {
    const description = describeSavedSearch({ query: '', filters: { category: 'dancer' } })
    expect(description).toContain('Category')
  })

  it('describes an unconstrained search', () => {
    expect(describeSavedSearch({ query: '', filters: {} })).toBe('All talent')
  })
})

describe('newMatchesBody', () => {
  it('handles singular and plural', () => {
    expect(newMatchesBody(1)).toBe('1 new talent matches this search since you last ran it')
    expect(newMatchesBody(3)).toBe('3 new talent match this search since you last ran it')
  })
})
