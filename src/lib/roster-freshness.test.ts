import { describe, it, expect } from 'vitest'
import { weekCutoffIso, rosterFreshnessLabel } from './roster-freshness'

describe('weekCutoffIso', () => {
  it('returns the instant exactly seven days before the given time', () => {
    expect(weekCutoffIso(new Date('2026-07-21T12:00:00.000Z'))).toBe('2026-07-14T12:00:00.000Z')
  })
})

describe('rosterFreshnessLabel', () => {
  it('returns null when the total is missing or zero', () => {
    expect(rosterFreshnessLabel(null, 5)).toBeNull()
    expect(rosterFreshnessLabel(undefined, 5)).toBeNull()
    expect(rosterFreshnessLabel(0, 5)).toBeNull()
  })

  it('formats totals with thousands separators and appends the weekly count', () => {
    expect(rosterFreshnessLabel(2400, 34)).toBe('from 2,400 profiles · 34 added this week')
  })

  it('omits the weekly segment when nothing was added this week', () => {
    expect(rosterFreshnessLabel(2400, 0)).toBe('from 2,400 profiles')
    expect(rosterFreshnessLabel(2400, null)).toBe('from 2,400 profiles')
  })

  it('uses the singular form for a single profile', () => {
    expect(rosterFreshnessLabel(1, 1)).toBe('from 1 profile · 1 added this week')
  })
})
