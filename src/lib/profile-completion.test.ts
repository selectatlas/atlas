import { describe, expect, it } from 'vitest'
import { getProfileCompletion } from './profile-completion'
import type { Profile } from '@/types'

const baseProfile: Profile = {
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

describe('getProfileCompletion', () => {
  it('returns zero when the profile is empty', () => {
    const result = getProfileCompletion({ ...baseProfile, talent_skills: [] })
    expect(result.percent).toBe(0)
    expect(result.missing.length).toBeGreaterThan(0)
  })

  it('returns full completion when required fields are present', () => {
    const result = getProfileCompletion({
      ...baseProfile,
      avatar_url: 'https://example.com/a.jpg',
      headline: 'Dancer',
      city: 'London',
      bio: 'Bio',
      availability: 'Available',
      rates: '£500/day',
      talent_skills: [{ id: '1', profile_id: '1', category: 'dancer', skill: 'Contemporary', proficiency: 'expert', created_at: '' }],
    })
    expect(result.percent).toBe(100)
    expect(result.missing).toHaveLength(0)
  })
})
