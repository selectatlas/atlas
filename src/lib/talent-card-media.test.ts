import { describe, expect, it } from 'vitest'
import { buildCardImages, CARD_IMAGE_CAP } from './talent-card-media'

describe('buildCardImages', () => {
  it('puts the avatar first and appends portfolio images', () => {
    expect(buildCardImages('a.jpg', ['b.jpg', 'c.jpg'])).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('caps at the free-tier limit', () => {
    expect(buildCardImages('a.jpg', ['b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'])).toHaveLength(CARD_IMAGE_CAP)
  })

  it('dedupes and drops empty values', () => {
    expect(buildCardImages('a.jpg', ['a.jpg', null, undefined, '', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg'])
  })

  it('works with no avatar', () => {
    expect(buildCardImages(null, ['b.jpg'])).toEqual(['b.jpg'])
    expect(buildCardImages(null, [])).toEqual([])
  })

  it('respects a custom cap for future tier limits', () => {
    expect(buildCardImages('a.jpg', ['b.jpg', 'c.jpg'], 2)).toEqual(['a.jpg', 'b.jpg'])
  })
})
