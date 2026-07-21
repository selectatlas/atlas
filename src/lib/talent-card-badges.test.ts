import { describe, expect, it } from 'vitest'
import { cardBadgesFromAttributes, hasCardBadges } from './talent-card-badges'

describe('cardBadgesFromAttributes', () => {
  it('reads true booleans', () => {
    expect(cardBadgesFromAttributes({ spact: true, stunt_register: true })).toEqual({ spact: true, stuntRegistered: true })
  })

  it('treats false, missing, and null attributes as no badge', () => {
    expect(cardBadgesFromAttributes({ spact: false })).toEqual({ spact: false, stuntRegistered: false })
    expect(cardBadgesFromAttributes({})).toEqual({ spact: false, stuntRegistered: false })
    expect(cardBadgesFromAttributes(null)).toEqual({ spact: false, stuntRegistered: false })
    expect(cardBadgesFromAttributes(undefined)).toEqual({ spact: false, stuntRegistered: false })
  })

  it('ignores truthy non-boolean values from untyped JSONB', () => {
    expect(cardBadgesFromAttributes({ spact: 'yes', stunt_register: 1 })).toEqual({ spact: false, stuntRegistered: false })
  })
})

describe('hasCardBadges', () => {
  it('is true only when at least one badge is set', () => {
    expect(hasCardBadges({ spact: true, stuntRegistered: false })).toBe(true)
    expect(hasCardBadges({ spact: false, stuntRegistered: true })).toBe(true)
    expect(hasCardBadges({ spact: false, stuntRegistered: false })).toBe(false)
    expect(hasCardBadges(undefined)).toBe(false)
  })
})
