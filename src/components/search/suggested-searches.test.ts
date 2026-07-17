import { describe, it, expect } from 'vitest'
import { SUGGESTED_SEARCHES } from './suggested-searches'

describe('SUGGESTED_SEARCHES', () => {
  it('has between 4 and 6 suggestions', () => {
    expect(SUGGESTED_SEARCHES.length).toBeGreaterThanOrEqual(4)
    expect(SUGGESTED_SEARCHES.length).toBeLessThanOrEqual(6)
  })

  it('includes the Bollywood-dancers-in-London flagship query', () => {
    const flagship = SUGGESTED_SEARCHES.find(
      s => /bollywood/i.test(s.query) && /london/i.test(s.query),
    )
    expect(flagship).toBeDefined()
    expect(flagship?.query).toMatch(/hindi/i)
    expect(flagship?.query).toMatch(/december/i)
  })

  it('has non-empty labels and queries with no duplicates', () => {
    for (const suggestion of SUGGESTED_SEARCHES) {
      expect(suggestion.label.trim().length).toBeGreaterThan(0)
      expect(suggestion.query.trim().length).toBeGreaterThan(0)
    }
    const queries = SUGGESTED_SEARCHES.map(s => s.query)
    expect(new Set(queries).size).toBe(queries.length)
    const labels = SUGGESTED_SEARCHES.map(s => s.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('covers demo-critical seed scenarios beyond the flagship', () => {
    const allQueries = SUGGESTED_SEARCHES.map(s => s.query.toLowerCase()).join(' | ')
    expect(allQueries).toMatch(/combat|boxing|martial/)
    expect(allQueries).toMatch(/food/)
  })
})
