import { describe, expect, it } from 'vitest'
import { DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES } from '@/lib/demo-data'
import { getProfileCompleteness } from '@/lib/profile-completeness'

describe('profile completeness', () => {
  it('returns a meaningful score and next steps', () => {
    const result = getProfileCompleteness(DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES[DEMO_PROFILE.id])

    expect(result.score).toBe(74)
    expect(result.missing.map(item => item.key)).toEqual(['photo', 'work'])
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
})
