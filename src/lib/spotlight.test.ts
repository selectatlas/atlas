import { describe, expect, it } from 'vitest'
import {
  SPOTLIGHT_DURATION_DAYS,
  formatSpotlightCountdown,
  getMockSpotlightActivation,
  getSpotlightStatus,
} from './spotlight'

const NOW = new Date('2026-07-17T12:00:00Z')

describe('getSpotlightStatus', () => {
  it('is inactive for a null activation', () => {
    const status = getSpotlightStatus(null, NOW)
    expect(status.active).toBe(false)
    expect(status.expiresAt).toBeNull()
    expect(status.percentRemaining).toBe(0)
  })

  it('is inactive for an invalid date string', () => {
    expect(getSpotlightStatus('not-a-date', NOW).active).toBe(false)
  })

  it('is inactive once the boost window has expired', () => {
    const activatedAt = new Date('2026-07-01T12:00:00Z') // 16 days before NOW
    const status = getSpotlightStatus(activatedAt, NOW)
    expect(status.active).toBe(false)
    expect(status.daysLeft).toBe(0)
  })

  it('is inactive exactly at expiry', () => {
    const activatedAt = new Date(NOW.getTime() - SPOTLIGHT_DURATION_DAYS * 24 * 60 * 60 * 1000)
    expect(getSpotlightStatus(activatedAt, NOW).active).toBe(false)
  })

  it('computes days, hours, expiry, and percent for a mid-run boost', () => {
    const activatedAt = new Date('2026-07-16T00:00:00Z') // 36h before NOW
    const status = getSpotlightStatus(activatedAt, NOW)
    expect(status.active).toBe(true)
    expect(status.daysLeft).toBe(5)
    expect(status.hoursLeft).toBe(12)
    expect(status.expiresAt?.toISOString()).toBe('2026-07-23T00:00:00.000Z')
    expect(status.percentRemaining).toBe(79) // 132 of 168 hours remaining
  })

  it('accepts ISO strings', () => {
    const status = getSpotlightStatus('2026-07-16T00:00:00Z', NOW)
    expect(status.active).toBe(true)
    expect(status.daysLeft).toBe(5)
  })

  it('caps percentRemaining at 100 for an activation timestamped in the future', () => {
    const activatedAt = new Date(NOW.getTime() + 60 * 60 * 1000)
    const status = getSpotlightStatus(activatedAt, NOW)
    expect(status.active).toBe(true)
    expect(status.percentRemaining).toBe(100)
  })
})

describe('formatSpotlightCountdown', () => {
  it('formats days and hours', () => {
    const status = getSpotlightStatus(new Date('2026-07-16T00:00:00Z'), NOW)
    expect(formatSpotlightCountdown(status)).toBe('5 days 12 hrs left')
  })

  it('uses singular units', () => {
    const activatedAt = new Date(NOW.getTime() - (6 * 24 - 1) * 60 * 60 * 1000) // 25h remaining
    const status = getSpotlightStatus(activatedAt, NOW)
    expect(status.daysLeft).toBe(1)
    expect(status.hoursLeft).toBe(1)
    expect(formatSpotlightCountdown(status)).toBe('1 day 1 hr left')
  })

  it('omits hours when the boundary is exact', () => {
    const activatedAt = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000) // exactly 2 days left
    expect(formatSpotlightCountdown(getSpotlightStatus(activatedAt, NOW))).toBe('2 days left')
  })

  it('handles the final hour', () => {
    const activatedAt = new Date(NOW.getTime() - (SPOTLIGHT_DURATION_DAYS * 24 - 0.5) * 60 * 60 * 1000)
    expect(formatSpotlightCountdown(getSpotlightStatus(activatedAt, NOW))).toBe('Less than 1 hr left')
  })

  it('reports inactive status', () => {
    expect(formatSpotlightCountdown(getSpotlightStatus(null, NOW))).toBe('Not active')
  })
})

describe('getMockSpotlightActivation', () => {
  it('always yields a mid-run countdown of 5 days 12 hrs', () => {
    const status = getSpotlightStatus(getMockSpotlightActivation(NOW), NOW)
    expect(status.active).toBe(true)
    expect(status.daysLeft).toBe(5)
    expect(status.hoursLeft).toBe(12)
  })
})
