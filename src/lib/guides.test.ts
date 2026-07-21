import { describe, it, expect } from 'vitest'
import { GUIDES, getGuide } from '@/lib/guides'

describe('guides content', () => {
  it('has unique slugs', () => {
    const slugs = GUIDES.map(guide => guide.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('includes the three knowledge-centre guides', () => {
    expect(GUIDES.map(guide => guide.slug)).toEqual(['photo-guidance', 'main-photos', 'profile-tips'])
  })

  it('every guide has a title, description, and non-empty sections with content', () => {
    for (const guide of GUIDES) {
      expect(guide.title.length).toBeGreaterThan(0)
      expect(guide.description.length).toBeGreaterThan(0)
      expect(guide.sections.length).toBeGreaterThan(0)
      for (const section of guide.sections) {
        const hasContent =
          (section.paragraphs?.length ?? 0) > 0 ||
          (section.bullets?.length ?? 0) > 0 ||
          (section.doDont?.length ?? 0) > 0
        expect(hasContent).toBe(true)
      }
    }
  })

  it('getGuide resolves known slugs and rejects unknown ones', () => {
    expect(getGuide('photo-guidance')?.title).toBe('Photo guidance')
    expect(getGuide('does-not-exist')).toBeUndefined()
  })
})
