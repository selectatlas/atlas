import { describe, it, expect } from 'vitest'
import { SUGGESTED_SEARCHES, examplesForScope } from './suggested-searches'

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

describe('examplesForScope', () => {
  it('gives two or three examples for every scope', () => {
    for (const scope of ['talent', 'jobs', 'global'] as const) {
      const examples = examplesForScope(scope)
      expect(examples.length).toBeGreaterThanOrEqual(2)
      expect(examples.length).toBeLessThanOrEqual(3)
    }
  })

  it('leads the talent scope with the flagship demo query', () => {
    expect(examplesForScope('talent')[0].query).toMatch(/bollywood/i)
  })

  it('keeps job examples job-shaped rather than talent-shaped', () => {
    const queries = examplesForScope('jobs').map(e => e.query.toLowerCase())
    expect(queries.every(q => /job|work|role/.test(q))).toBe(true)
  })

  it('spans more than one surface in the global scope', () => {
    const labels = examplesForScope('global').map(e => e.label.toLowerCase()).join(' | ')
    expect(labels).toMatch(/job/)
    expect(labels).toMatch(/setting/)
  })

  it('never returns an empty label or query', () => {
    for (const scope of ['talent', 'jobs', 'global'] as const) {
      for (const example of examplesForScope(scope)) {
        expect(example.label.trim().length).toBeGreaterThan(0)
        expect(example.query.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
