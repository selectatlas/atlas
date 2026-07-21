import { describe, it, expect } from 'vitest'
import { TALENT_FILTERS, filtersForCategory, filtersForCategories } from './filter-taxonomy'
import type { Category } from '@/types'

function keys(definitions: readonly { key: string }[]) {
  return definitions.map(definition => definition.key)
}

// Which attribute sections a talent can edit is driven entirely by this
// function. The editor previously derived a single category from the first
// skill row, so a dancer/actor saw only half of what applied to them.
describe('filtersForCategories', () => {
  it('returns every filter when no discipline is declared', () => {
    // Offering everything beats filtersForCategory('all'), which returns only
    // universal filters and hides physical attributes from a new talent.
    expect(filtersForCategories([])).toEqual(TALENT_FILTERS)
  })

  it('matches the single-category helper for one discipline', () => {
    for (const category of ['dancer', 'actor', 'photographer_videographer', 'content_creator'] as Category[]) {
      expect(keys(filtersForCategories([category]))).toEqual(keys(filtersForCategory(category)))
    }
  })

  it('unions the filters of every discipline the talent works in', () => {
    const dancerOnly = new Set(keys(filtersForCategory('dancer')))
    const actorOnly = new Set(keys(filtersForCategory('actor')))
    const both = new Set(keys(filtersForCategories(['dancer', 'actor'])))

    for (const key of dancerOnly) expect(both.has(key)).toBe(true)
    for (const key of actorOnly) expect(both.has(key)).toBe(true)
  })

  it('never returns a filter that belongs to no requested discipline', () => {
    for (const definition of filtersForCategories(['content_creator'])) {
      if (definition.categories === 'all') continue
      expect(definition.categories).toContain('content_creator')
    }
  })

  it('does not duplicate filters shared across disciplines', () => {
    const result = keys(filtersForCategories(['dancer', 'actor', 'photographer_videographer', 'content_creator']))
    expect(result).toHaveLength(new Set(result).size)
  })

  it('preserves the canonical taxonomy order', () => {
    const result = keys(filtersForCategories(['dancer', 'actor']))
    const canonical = keys(TALENT_FILTERS).filter(key => result.includes(key))
    expect(result).toEqual(canonical)
  })
})
