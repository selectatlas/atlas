import type { ReviewSummary, TalentReview } from '@/types'

const RATINGS = [1, 2, 3, 4, 5] as const

export const SUB_RATING_KEYS = ['rating_communication', 'rating_reliability', 'rating_craft'] as const

export type SubRatingKey = (typeof SUB_RATING_KEYS)[number]

// Public columns of talent_reviews. recommend_score is private (not granted
// to authenticated), so selects must name columns instead of using '*'.
export const REVIEW_PUBLIC_COLUMNS =
  'id, talent_id, reviewer_id, rating, body, project_title, created_at, rating_communication, rating_reliability, rating_craft'

type SummarizableReview = Pick<TalentReview, 'rating'> &
  Partial<Pick<TalentReview, SubRatingKey>>

function roundedAverage(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

/** Aggregate a list of reviews into count, 1-dp average, a 5→1 star breakdown, and sub-rating averages. */
export function summarizeReviews(reviews: SummarizableReview[]): ReviewSummary {
  const breakdown: ReviewSummary['breakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  let total = 0
  for (const review of reviews) {
    const rating = RATINGS.find(value => value === review.rating)
    if (!rating) continue
    breakdown[rating] += 1
    total += rating
  }

  const count = RATINGS.reduce((sum, rating) => sum + breakdown[rating], 0)

  const subAverage = (key: SubRatingKey): number | null =>
    roundedAverage(
      reviews
        .map(review => review[key])
        .filter((value): value is number => typeof value === 'number' && value >= 1 && value <= 5),
    )

  return {
    count,
    average: count > 0 ? Math.round((total / count) * 10) / 10 : null,
    breakdown,
    sub_averages: {
      communication: subAverage('rating_communication'),
      reliability: subAverage('rating_reliability'),
      craft: subAverage('rating_craft'),
    },
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
