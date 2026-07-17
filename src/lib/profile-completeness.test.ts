import { describe, expect, it } from 'vitest'
import { DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES } from '@/lib/demo-data'
import { getProfileCompleteness } from '@/lib/profile-completeness'
import type { Profile } from '@/types'

const EMPTY_PROFILE: Profile = {
  id: '1',
  account_type: 'talent',
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: null,
  cover_url: null,
  headline: null,
  city: null,
  country: null,
  bio: null,
  rates: null,
  availability: null,
  showreel_url: null,
  profile_visibility: 'public',
  created_at: new Date().toISOString(),
}

describe('profile completeness', () => {
  it('weights always sum to 100', () => {
    const result = getProfileCompleteness(DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id])
    expect(result.items.reduce((total, item) => total + item.weight, 0)).toBe(100)
  })

  it('returns a meaningful score and next steps', () => {
    const result = getProfileCompleteness(DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id])

    expect(result.score).toBe(88)
    expect(result.missing.map(item => item.key)).toEqual(['photo'])
  })

  it('recognises a profile with evidence as ready to be discovered', () => {
    const result = getProfileCompleteness({
      ...DEMO_PROFILE,
      avatar_url: 'https://example.com/avatar.jpg',
      showreel_url: 'https://example.com/showreel',
    }, DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id])

    expect(result.score).toBe(100)
    expect(result.missing).toHaveLength(0)
  })

  it('scores an empty profile at zero with every item missing', () => {
    const result = getProfileCompleteness({ ...EMPTY_PROFILE, talent_skills: [] })

    expect(result.score).toBe(0)
    expect(result.completed).toHaveLength(0)
    expect(result.missing).toHaveLength(result.items.length)
  })

  it('works without attributes and splits items into completed and missing', () => {
    const result = getProfileCompleteness({
      ...EMPTY_PROFILE,
      avatar_url: 'https://example.com/a.jpg',
      headline: 'Dancer',
      talent_skills: [],
    })

    expect(result.completed.map(item => item.key)).toEqual(['photo', 'headline'])
    expect(result.score).toBe(24)
    expect(result.completed.length + result.missing.length).toBe(result.items.length)
  })

  it('surfaces the case-study step when no credit has an outcome', () => {
    const result = getProfileCompleteness({
      ...DEMO_PROFILE,
      credits: DEMO_PROFILE.credits.map(credit => ({ ...credit, outcome: null })),
    }, DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id])

    expect(result.missing.map(item => item.key)).toContain('case-study')
  })
})
