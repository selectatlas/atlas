import { describe, it, expect } from 'vitest'
import {
  TALENT_LEVELS,
  TALENT_LEVEL_LABELS,
  TALENT_LEVEL_THRESHOLDS,
  buildTalentLevelMetrics,
  computeTalentLevel,
  getTalentLevelProgress,
  meetsTalentLevelThresholds,
  nextTalentLevel,
  type TalentLevelMetrics,
} from './talent-level'

function metrics(overrides: Partial<TalentLevelMetrics> = {}): TalentLevelMetrics {
  return {
    reviewAverage: null,
    reviewCount: 0,
    hiredCount: 0,
    responseRate: null,
    ...overrides,
  }
}

describe('computeTalentLevel', () => {
  it('returns new for a talent with no signal', () => {
    expect(computeTalentLevel(metrics())).toBe('new')
  })

  it('returns rising from the first strong review', () => {
    expect(computeTalentLevel(metrics({ reviewAverage: 4.0, reviewCount: 1 }))).toBe('rising')
  })

  it('stays new when the review average is below the rising bar', () => {
    expect(computeTalentLevel(metrics({ reviewAverage: 3.9, reviewCount: 5 }))).toBe('new')
  })

  it('returns established at three 4.5+ reviews with a healthy response rate', () => {
    expect(
      computeTalentLevel(metrics({ reviewAverage: 4.5, reviewCount: 3, responseRate: 0.5 })),
    ).toBe('established')
  })

  it('caps at rising when the response rate is below the established bar', () => {
    expect(
      computeTalentLevel(metrics({ reviewAverage: 4.9, reviewCount: 10, hiredCount: 4, responseRate: 0.4 })),
    ).toBe('rising')
  })

  it('returns top rated when every threshold is met', () => {
    expect(
      computeTalentLevel(
        metrics({ reviewAverage: 4.8, reviewCount: 5, hiredCount: 1, responseRate: 0.9 }),
      ),
    ).toBe('top_rated')
  })

  it('caps at established without a hired booking', () => {
    expect(
      computeTalentLevel(metrics({ reviewAverage: 4.9, reviewCount: 8, hiredCount: 0, responseRate: 1 })),
    ).toBe('established')
  })

  it('does not penalise never-contacted talent on response rate', () => {
    expect(
      computeTalentLevel(metrics({ reviewAverage: 4.8, reviewCount: 5, hiredCount: 1, responseRate: null })),
    ).toBe('top_rated')
  })
})

describe('meetsTalentLevelThresholds', () => {
  it('requires a review average whenever the threshold is above zero', () => {
    expect(
      meetsTalentLevelThresholds(
        metrics({ reviewAverage: null, reviewCount: 3, hiredCount: 2, responseRate: 1 }),
        TALENT_LEVEL_THRESHOLDS.established,
      ),
    ).toBe(false)
  })

  it('treats exact threshold values as met', () => {
    expect(
      meetsTalentLevelThresholds(
        metrics({ reviewAverage: 4.7, reviewCount: 4, hiredCount: 1, responseRate: 0.8 }),
        TALENT_LEVEL_THRESHOLDS.top_rated,
      ),
    ).toBe(true)
  })
})

describe('buildTalentLevelMetrics', () => {
  it('derives the response rate from contacted and responded counts', () => {
    const built = buildTalentLevelMetrics({
      reviewAverage: 4.5,
      reviewCount: 3,
      hiredCount: 1,
      contactedCount: 4,
      respondedCount: 3,
    })
    expect(built.responseRate).toBe(0.75)
  })

  it('returns a null response rate when never contacted', () => {
    const built = buildTalentLevelMetrics({
      reviewAverage: null,
      reviewCount: 0,
      hiredCount: 0,
      contactedCount: 0,
      respondedCount: 0,
    })
    expect(built.responseRate).toBeNull()
  })

  it('nulls the review average when there are no reviews and clamps negatives', () => {
    const built = buildTalentLevelMetrics({
      reviewAverage: 4.2,
      reviewCount: 0,
      hiredCount: -2,
      contactedCount: -1,
      respondedCount: 5,
    })
    expect(built.reviewAverage).toBeNull()
    expect(built.hiredCount).toBe(0)
    expect(built.responseRate).toBeNull()
  })

  it('caps responded at contacted so the rate never exceeds 1', () => {
    const built = buildTalentLevelMetrics({
      reviewAverage: 5,
      reviewCount: 1,
      hiredCount: 0,
      contactedCount: 2,
      respondedCount: 9,
    })
    expect(built.responseRate).toBe(1)
  })
})

describe('nextTalentLevel', () => {
  it('walks the ladder in order and ends at top rated', () => {
    expect(nextTalentLevel('new')).toBe('rising')
    expect(nextTalentLevel('rising')).toBe('established')
    expect(nextTalentLevel('established')).toBe('top_rated')
    expect(nextTalentLevel('top_rated')).toBeNull()
  })
})

describe('getTalentLevelProgress', () => {
  it('measures a new talent against the rising thresholds', () => {
    const progress = getTalentLevelProgress(metrics())
    expect(progress.level).toBe('new')
    expect(progress.next).toBe('rising')
    // Rising only requires reviews - hired and response thresholds are 0.
    expect(progress.rows.map(row => row.key)).toEqual(['reviewCount', 'reviewAverage'])
    expect(progress.rows.every(row => !row.met)).toBe(true)
  })

  it('shows partial progress with clamped values', () => {
    const progress = getTalentLevelProgress(
      metrics({ reviewAverage: 4.6, reviewCount: 2, hiredCount: 0, responseRate: 0.25 }),
    )
    expect(progress.level).toBe('rising')
    expect(progress.next).toBe('established')
    const reviewRow = progress.rows.find(row => row.key === 'reviewCount')
    expect(reviewRow?.progress).toBeCloseTo(2 / 3)
    const responseRow = progress.rows.find(row => row.key === 'responseRate')
    expect(responseRow?.met).toBe(false)
    expect(responseRow?.progress).toBeCloseTo(0.5)
  })

  it('marks a null response rate as not blocking and shows a friendly value', () => {
    const progress = getTalentLevelProgress(
      metrics({ reviewAverage: 4.6, reviewCount: 3, hiredCount: 0, responseRate: null }),
    )
    const responseRow = progress.rows.find(row => row.key === 'responseRate')
    expect(responseRow?.met).toBe(true)
    expect(responseRow?.current).toBe('No invites yet')
  })

  it('measures top rated talent against their own thresholds, all met', () => {
    const progress = getTalentLevelProgress(
      metrics({ reviewAverage: 4.9, reviewCount: 6, hiredCount: 2, responseRate: 1 }),
    )
    expect(progress.level).toBe('top_rated')
    expect(progress.next).toBeNull()
    expect(progress.rows.length).toBeGreaterThan(0)
    expect(progress.rows.every(row => row.met)).toBe(true)
  })
})

describe('level constants', () => {
  it('labels every level', () => {
    for (const level of TALENT_LEVELS) {
      expect(TALENT_LEVEL_LABELS[level]).toBeTruthy()
    }
  })

  it('thresholds are monotonically non-decreasing up the ladder', () => {
    const { rising, established, top_rated: top } = TALENT_LEVEL_THRESHOLDS
    for (const key of ['reviewAverage', 'reviewCount', 'hiredCount', 'responseRate'] as const) {
      expect(established[key]).toBeGreaterThanOrEqual(rising[key])
      expect(top[key]).toBeGreaterThanOrEqual(established[key])
    }
  })
})
