import { describe, it, expect } from 'vitest'
import { alertToDiscoverFilters, mapJobAlertRow, parseJobAlertInput, sanitizeAlertFilters } from './job-alerts'

describe('parseJobAlertInput', () => {
  it('accepts a query-only alert', () => {
    const result = parseJobAlertInput({ name: 'Ballet gigs', query: 'ballet london' })
    expect(result).toMatchObject({ ok: true, input: { name: 'Ballet gigs', query: 'ballet london', filters: {} } })
  })

  it('accepts a filters-only alert', () => {
    const result = parseJobAlertInput({ name: 'Remote work', filters: { work: 'remote', rate: 'over500' } })
    expect(result).toMatchObject({ ok: true, input: { filters: { work: 'remote', rate: 'over500' } } })
  })

  it('rejects a missing name and an alert with no scope at all', () => {
    expect(parseJobAlertInput({ query: 'ballet' }).ok).toBe(false)
    expect(parseJobAlertInput({ name: 'Everything' }).ok).toBe(false)
  })

  it('rejects filter values the discover parser would reject', () => {
    expect(parseJobAlertInput({ name: 'Bad', filters: { work: 'moon' } }).ok).toBe(false)
    expect(parseJobAlertInput({ name: 'Bad', filters: { category: 'astronaut' } }).ok).toBe(false)
  })
})

describe('alertToDiscoverFilters', () => {
  it('rebuilds validated discover filters from stored params', () => {
    const result = alertToDiscoverFilters({
      query: 'video shoot',
      filters: { category: 'dancer,actor', work: 'in_person', loc: 'London', rate: '250to500' },
    })
    expect(result).toMatchObject({
      ok: true,
      filters: {
        categories: ['dancer', 'actor'],
        search: 'video shoot',
        workType: 'in_person',
        location: 'London',
        budgetBand: '250to500',
      },
    })
  })
})

describe('sanitizeAlertFilters', () => {
  it('keeps only known keys and drops empty values', () => {
    expect(sanitizeAlertFilters({ work: 'remote', loc: ' ', bogus: 'x', rate: 'over500' }))
      .toEqual({ work: 'remote', rate: 'over500' })
    expect(sanitizeAlertFilters(null)).toEqual({})
  })
})

describe('mapJobAlertRow', () => {
  it('maps a row and attaches the computed new count', () => {
    const row = {
      id: 'a1', name: 'Remote', query: '', filters: { work: 'remote' },
      last_viewed_at: '2026-07-01T00:00:00Z', created_at: '2026-06-01T00:00:00Z',
    }
    expect(mapJobAlertRow(row, 3)).toMatchObject({ id: 'a1', filters: { work: 'remote' }, new_count: 3 })
    expect(mapJobAlertRow(row)).not.toHaveProperty('new_count')
  })
})
