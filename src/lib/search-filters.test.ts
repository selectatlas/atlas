import { describe, expect, it } from 'vitest'
import { filtersToDatabase, parseSearchFilterObject, parseSearchFilterParams, serializeSearchFilters, type SearchFilters } from './search-filters'

describe('search filter contract', () => {
  it('round-trips repeated multi values, booleans and ranges through the URL', () => {
    const filters: SearchFilters = {
      category: 'actor',
      gender: ['female', 'non_binary'],
      age: { min: 25, max: 40 },
      spact: false,
    }

    const parsed = parseSearchFilterParams(serializeSearchFilters(filters))
    expect(parsed).toEqual({ ok: true, filters })
  })

  it('rejects unknown filters and invalid options', () => {
    expect(parseSearchFilterObject({ admin: true })).toEqual({ ok: false, error: 'Unknown filter: admin' })
    expect(parseSearchFilterObject({ gender: ['not-a-gender'] })).toEqual({ ok: false, error: 'Invalid value for filter: gender' })
  })

  it('rejects inverted and out-of-bounds ranges', () => {
    expect(parseSearchFilterObject({ age: { min: 40, max: 20 } }).ok).toBe(false)
    expect(parseSearchFilterObject({ height: { min: 50 } }).ok).toBe(false)
  })

  it('keeps public JSON and restricted preferences in separate database envelopes', () => {
    const parsed = parseSearchFilterObject({ location: 'London', hair_type: ['3b_curly'], nudity: false })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(filtersToDatabase(parsed.filters)).toEqual({
      location: 'London',
      attributes: { hair_type: ['3b_curly'] },
      sensitive: { nudity: false },
    })
  })
})
