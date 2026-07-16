import { describe, expect, it } from 'vitest'
import { DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES } from '@/lib/demo-data'
import { getProfileCompleteness } from '@/lib/profile-completeness'

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

  it('surfaces the case-study step when no credit has an outcome', () => {
    const result = getProfileCompleteness({
      ...DEMO_PROFILE,
      credits: DEMO_PROFILE.credits.map(credit => ({ ...credit, outcome: null })),
    }, DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id])

    expect(result.missing.map(item => item.key)).toContain('case-study')
  })
})
