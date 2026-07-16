import { describe, expect, it } from 'vitest'
import { formatRating, pickHighlights, summarizeReviews } from './reviews'
import type { TalentReview } from '@/types'

function review(overrides: Partial<TalentReview>): TalentReview {
  return {
    id: 'r1',
    talent_id: 't1',
    reviewer_id: 'h1',
    rating: 5,
    body: 'Great to work with.',
    project_title: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('summarizeReviews', () => {
  it('returns an empty summary for no reviews', () => {
    expect(summarizeReviews([])).toEqual({
      count: 0,
      average: null,
      breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    })
  })

  it('computes count, average, and breakdown', () => {
    const summary = summarizeReviews([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 2 }])
    expect(summary.count).toBe(4)
    expect(summary.average).toBe(4)
    expect(summary.breakdown).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 2 })
  })

  it('rounds the average to one decimal place', () => {
    expect(summarizeReviews([{ rating: 5 }, { rating: 5 }, { rating: 4 }]).average).toBe(4.7)
  })

  it('ignores out-of-range ratings', () => {
    const summary = summarizeReviews([{ rating: 5 }, { rating: 0 }, { rating: 9 }])
    expect(summary.count).toBe(1)
    expect(summary.average).toBe(5)
  })
})

describe('pickHighlights', () => {
  it('prefers higher ratings, then longer bodies', () => {
    const short5 = review({ id: 'a', rating: 5, body: 'Great.' })
    const long5 = review({ id: 'b', rating: 5, body: 'Truly outstanding collaborator, delivered ahead of schedule.' })
    const long4 = review({ id: 'c', rating: 4, body: 'Very good, would book again for the next campaign for sure.' })
    expect(pickHighlights([short5, long4, long5]).map(r => r.id)).toEqual(['b', 'a'])
  })

  it('skips empty bodies and respects the limit', () => {
    const empty = review({ id: 'a', body: '   ' })
    const kept = review({ id: 'b' })
    expect(pickHighlights([empty, kept], 2).map(r => r.id)).toEqual(['b'])
  })
})

describe('formatRating', () => {
  it('formats to one decimal place', () => {
    expect(formatRating(5)).toBe('5.0')
    expect(formatRating(4.86)).toBe('4.9')
  })

  it('returns null for null', () => {
    expect(formatRating(null)).toBeNull()
  })
})
