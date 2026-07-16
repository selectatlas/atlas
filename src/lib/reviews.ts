import type { ReviewSummary, TalentReview } from '@/types'

const RATINGS = [1, 2, 3, 4, 5] as const

/** Aggregate a list of reviews into count, 1-dp average, and a 5→1 star breakdown. */
export function summarizeReviews(reviews: Array<Pick<TalentReview, 'rating'>>): ReviewSummary {
  const breakdown: ReviewSummary['breakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  let total = 0
  for (const review of reviews) {
    const rating = RATINGS.find(value => value === review.rating)
    if (!rating) continue
    breakdown[rating] += 1
    total += rating
  }

  const count = RATINGS.reduce((sum, rating) => sum + breakdown[rating], 0)

  return {
    count,
    average: count > 0 ? Math.round((total / count) * 10) / 10 : null,
    breakdown,
  }
}

/** Pick the strongest pull-quotes: highest rating first, then longest body. */
export function pickHighlights(reviews: TalentReview[], limit = 2): TalentReview[] {
  return [...reviews]
    .filter(review => review.body.trim().length > 0)
    .sort((a, b) => b.rating - a.rating || b.body.length - a.body.length)
    .slice(0, limit)
}

/** Format an average rating for display, e.g. 4.9 → "4.9", 5 → "5.0". */
export function formatRating(average: number | null): string | null {
  if (average === null || Number.isNaN(average)) return null
  return average.toFixed(1)
}
