import { describe, expect, it } from 'vitest'
import { DEMO_PROFILE } from '@/lib/demo-data'
import { getProfileCompleteness } from '@/lib/profile-completeness'

describe('profile completeness', () => {
  it('returns a meaningful score and next steps', () => {
    const result = getProfileCompleteness(DEMO_PROFILE)

    expect(result.score).toBe(70)
    expect(result.missing.map(item => item.key)).toEqual(['photo', 'work'])
  })

  it('recognises a profile with evidence as ready to be discovered', () => {
    const result = getProfileCompleteness({
      ...DEMO_PROFILE,
      avatar_url: 'https://example.com/avatar.jpg',
      showreel_url: 'https://example.com/showreel',
    })

    expect(result.score).toBe(100)
    expect(result.missing).toHaveLength(0)
  })
})
