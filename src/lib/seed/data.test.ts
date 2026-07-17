import { describe, expect, it } from 'vitest'
import { SEED_PROFILES, SEED_VERIFIED_AT_ISO, seedVerification } from './data'

describe('seedVerification', () => {
  it('verifies a majority of demo talent profiles', () => {
    const verifiedCount = SEED_PROFILES.filter(
      profile => seedVerification(profile).verified_at !== null
    ).length
    expect(verifiedCount).toBeGreaterThan(SEED_PROFILES.length / 2)
  })

  it('leaves some profiles unverified so the badge reads as earned', () => {
    const unverifiedCount = SEED_PROFILES.filter(
      profile => seedVerification(profile).verified_at === null
    ).length
    expect(unverifiedCount).toBeGreaterThan(0)
  })

  it('grants verified categories from the profile skills', () => {
    for (const profile of SEED_PROFILES) {
      const { verified_at, verified_categories } = seedVerification(profile)
      if (verified_at === null) {
        expect(verified_categories).toEqual([])
        continue
      }
      expect(verified_at).toBe(SEED_VERIFIED_AT_ISO)
      expect(verified_categories.length).toBeGreaterThan(0)
      const skillCategories = new Set(profile.skills.map(skill => skill.category))
      for (const category of verified_categories) {
        expect(skillCategories.has(category)).toBe(true)
      }
    }
  })

  it('keeps the featured-talent grants in demo-world consistent (deepika and marcus stay unverified)', () => {
    for (const email of ['deepika.nair@atlas-demo.com', 'marcus.cole@atlas-demo.com']) {
      const profile = SEED_PROFILES.find(p => p.email === email)
      expect(profile).toBeDefined()
      expect(seedVerification(profile!).verified_at).toBeNull()
    }
  })
})
