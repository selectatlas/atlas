// Talent level track - Fiverr-style compounding status ladder
// (New → Rising → Established → Top Rated), computed at read time from
// existing data: review average, review count, hired applications, and the
// share of hirer outreach the talent responded to. No tables, no cron.
//
// Thresholds are deliberately calibrated so the seeded demo world spreads
// across the whole ladder (see src/lib/seed/demo-world.ts).

export const TALENT_LEVELS = ['new', 'rising', 'established', 'top_rated'] as const

export type TalentLevel = (typeof TALENT_LEVELS)[number]

export type RankedTalentLevel = Exclude<TalentLevel, 'new'>

export const TALENT_LEVEL_LABELS: Record<TalentLevel, string> = {
  new: 'New',
  rising: 'Rising',
  established: 'Established',
  top_rated: 'Top Rated',
}

export interface TalentLevelMetrics {
  /** 1-5 average across reviews; null when the talent has no reviews. */
  reviewAverage: number | null
  reviewCount: number
  /** Applications that reached the hired status. */
  hiredCount: number
  /** 0-1 share of non-draft outreach the talent responded to; null when never contacted. */
  responseRate: number | null
}

export interface TalentLevelThresholds {
  reviewAverage: number
  reviewCount: number
  hiredCount: number
  responseRate: number
}

/**
 * Per-metric minimums for each ranked level. A talent holds the highest level
 * whose thresholds they meet on every metric. A threshold of 0 means the
 * metric is not required at that level.
 */
export const TALENT_LEVEL_THRESHOLDS: Record<RankedTalentLevel, TalentLevelThresholds> = {
  rising: { reviewAverage: 4.0, reviewCount: 1, hiredCount: 0, responseRate: 0 },
  established: { reviewAverage: 4.5, reviewCount: 3, hiredCount: 0, responseRate: 0.5 },
  top_rated: { reviewAverage: 4.7, reviewCount: 4, hiredCount: 1, responseRate: 0.8 },
}

/**
 * True when the metrics satisfy every threshold. Talent who have never
 * received outreach are not penalised on response rate - there is no evidence
 * against them yet.
 */
export function meetsTalentLevelThresholds(
  metrics: TalentLevelMetrics,
  thresholds: TalentLevelThresholds,
): boolean {
  if (metrics.reviewCount < thresholds.reviewCount) return false
  if (
    thresholds.reviewAverage > 0 &&
    (metrics.reviewAverage === null || metrics.reviewAverage < thresholds.reviewAverage)
  ) {
    return false
  }
  if (metrics.hiredCount < thresholds.hiredCount) return false
  if (metrics.responseRate !== null && metrics.responseRate < thresholds.responseRate) return false
  return true
}

/** The highest level whose thresholds the metrics meet; 'new' otherwise. */
export function computeTalentLevel(metrics: TalentLevelMetrics): TalentLevel {
  const ranked: RankedTalentLevel[] = ['top_rated', 'established', 'rising']
  for (const level of ranked) {
    if (meetsTalentLevelThresholds(metrics, TALENT_LEVEL_THRESHOLDS[level])) return level
  }
  return 'new'
}

export interface TalentLevelCounts {
  reviewAverage: number | null
  reviewCount: number
  hiredCount: number
  /** Non-draft outreach the talent has received. */
  contactedCount: number
  /** Outreach the talent responded to. */
  respondedCount: number
}

/** Normalise raw counts into level metrics (derives the response rate). */
export function buildTalentLevelMetrics(counts: TalentLevelCounts): TalentLevelMetrics {
  const reviewCount = Math.max(0, counts.reviewCount)
  const contacted = Math.max(0, counts.contactedCount)
  const responded = Math.min(Math.max(0, counts.respondedCount), contacted)
  return {
    reviewAverage: reviewCount > 0 ? counts.reviewAverage : null,
    reviewCount,
    hiredCount: Math.max(0, counts.hiredCount),
    responseRate: contacted > 0 ? responded / contacted : null,
  }
}

/** The level after the given one, or null when already Top Rated. */
export function nextTalentLevel(level: TalentLevel): RankedTalentLevel | null {
  const index = TALENT_LEVELS.indexOf(level)
  if (index === -1 || index === TALENT_LEVELS.length - 1) return null
  return TALENT_LEVELS[index + 1] as RankedTalentLevel
}

export interface TalentLevelProgressRow {
  key: keyof TalentLevelThresholds
  label: string
  /** Display value for the talent's current number. */
  current: string
  /** Display value for the threshold. */
  target: string
  /** 0-1 progress toward the threshold, clamped. */
  progress: number
  met: boolean
}

export interface TalentLevelProgress {
  level: TalentLevel
  /** Level the rows measure progress toward; null when already Top Rated. */
  next: RankedTalentLevel | null
  rows: TalentLevelProgressRow[]
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * Per-metric progress toward the next level. When already Top Rated the rows
 * measure against the Top Rated thresholds (all met - a "keep it up" view).
 * Metrics with a 0 threshold at the target level are omitted.
 */
export function getTalentLevelProgress(metrics: TalentLevelMetrics): TalentLevelProgress {
  const level = computeTalentLevel(metrics)
  const next = nextTalentLevel(level)
  const thresholds = TALENT_LEVEL_THRESHOLDS[next ?? 'top_rated']
  const rows: TalentLevelProgressRow[] = []

  if (thresholds.reviewCount > 0) {
    rows.push({
      key: 'reviewCount',
      label: 'Reviews',
      current: String(metrics.reviewCount),
      target: String(thresholds.reviewCount),
      progress: clamp01(metrics.reviewCount / thresholds.reviewCount),
      met: metrics.reviewCount >= thresholds.reviewCount,
    })
  }

  if (thresholds.reviewAverage > 0) {
    rows.push({
      key: 'reviewAverage',
      label: 'Review average',
      current: metrics.reviewAverage === null ? 'No reviews yet' : metrics.reviewAverage.toFixed(1),
      target: thresholds.reviewAverage.toFixed(1),
      progress: metrics.reviewAverage === null ? 0 : clamp01(metrics.reviewAverage / thresholds.reviewAverage),
      met: metrics.reviewAverage !== null && metrics.reviewAverage >= thresholds.reviewAverage,
    })
  }

  if (thresholds.hiredCount > 0) {
    rows.push({
      key: 'hiredCount',
      label: 'Completed bookings',
      current: String(metrics.hiredCount),
      target: String(thresholds.hiredCount),
      progress: clamp01(metrics.hiredCount / thresholds.hiredCount),
      met: metrics.hiredCount >= thresholds.hiredCount,
    })
  }

  if (thresholds.responseRate > 0) {
    rows.push({
      key: 'responseRate',
      label: 'Response rate',
      current: metrics.responseRate === null ? 'No invites yet' : `${Math.round(metrics.responseRate * 100)}%`,
      target: `${Math.round(thresholds.responseRate * 100)}%`,
      // Never-contacted talent are not penalised, mirroring computeTalentLevel.
      progress: metrics.responseRate === null ? 1 : clamp01(metrics.responseRate / thresholds.responseRate),
      met: metrics.responseRate === null || metrics.responseRate >= thresholds.responseRate,
    })
  }

  return { level, next, rows }
}
