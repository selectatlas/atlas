import { describe, it, expect } from 'vitest'
import { needsOnboarding, validateOnboardingPayload, MAX_ONBOARDING_SKILLS } from './onboarding'

describe('needsOnboarding', () => {
  it('returns true when there is no profile', () => {
    expect(needsOnboarding(null)).toBe(true)
    expect(needsOnboarding(undefined)).toBe(true)
  })

  it('returns true for a fresh profile with no headline and no skills', () => {
    expect(needsOnboarding({ headline: null, talent_skills: [] })).toBe(true)
    expect(needsOnboarding({ headline: '   ', talent_skills: [] })).toBe(true)
    expect(needsOnboarding({ headline: null })).toBe(true)
  })

  it('returns false once a headline is set', () => {
    expect(needsOnboarding({ headline: 'Bollywood Dancer', talent_skills: [] })).toBe(false)
  })

  it('returns false once a skill exists', () => {
    expect(needsOnboarding({ headline: null, talent_skills: [{ id: 'skill-1' }] })).toBe(false)
  })
})

describe('validateOnboardingPayload', () => {
  const VALID = {
    category: 'dancer',
    skills: ['Bollywood', 'Kathak'],
    headline: 'Bollywood Dancer | Choreographer',
    bio: 'Ten years performing across the UK.',
    city: 'London',
    country: 'UK',
    rates: '£300 per day',
    availableNow: true,
  }

  it('accepts a complete payload', () => {
    const result = validateOnboardingPayload(VALID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.category).toBe('dancer')
      expect(result.value.skills).toEqual(['Bollywood', 'Kathak'])
      expect(result.value.availableNow).toBe(true)
    }
  })

  it('treats blank optional fields as null', () => {
    const result = validateOnboardingPayload({ ...VALID, bio: '  ', city: '', rates: undefined, availableNow: null })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.bio).toBeNull()
      expect(result.value.city).toBeNull()
      expect(result.value.rates).toBeNull()
      expect(result.value.availableNow).toBeNull()
    }
  })

  it('trims and dedupes skills', () => {
    const result = validateOnboardingPayload({ ...VALID, skills: [' Bollywood ', 'Bollywood', 'Kathak'] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.skills).toEqual(['Bollywood', 'Kathak'])
  })

  it('rejects non-object input', () => {
    expect(validateOnboardingPayload(null).ok).toBe(false)
    expect(validateOnboardingPayload('dancer').ok).toBe(false)
    expect(validateOnboardingPayload([]).ok).toBe(false)
  })

  it('rejects an unknown category', () => {
    const result = validateOnboardingPayload({ ...VALID, category: 'astronaut' })
    expect(result).toEqual({ ok: false, error: 'Pick a category' })
  })

  it('rejects an empty skill list', () => {
    expect(validateOnboardingPayload({ ...VALID, skills: [] }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, skills: ['   '] }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, skills: 'Bollywood' }).ok).toBe(false)
  })

  it('rejects too many skills', () => {
    const skills = Array.from({ length: MAX_ONBOARDING_SKILLS + 1 }, (_, i) => `Skill ${i}`)
    expect(validateOnboardingPayload({ ...VALID, skills }).ok).toBe(false)
  })

  it('requires a headline within length limits', () => {
    expect(validateOnboardingPayload({ ...VALID, headline: '' }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, headline: '   ' }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, headline: 'x'.repeat(121) }).ok).toBe(false)
  })

  it('rejects over-long optional fields instead of silently truncating', () => {
    expect(validateOnboardingPayload({ ...VALID, bio: 'x'.repeat(2001) }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, city: 'x'.repeat(81) }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, rates: 'x'.repeat(121) }).ok).toBe(false)
  })

  it('rejects a non-boolean availability flag', () => {
    expect(validateOnboardingPayload({ ...VALID, availableNow: 'yes' }).ok).toBe(false)
  })

  it('defaults showreel and first credit to null when omitted', () => {
    const result = validateOnboardingPayload(VALID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.showreelUrl).toBeNull()
      expect(result.value.firstCredit).toBeNull()
    }
  })

  it('accepts a valid https showreel link', () => {
    const result = validateOnboardingPayload({ ...VALID, showreelUrl: 'https://youtube.com/watch?v=abc12345' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.showreelUrl).toBe('https://youtube.com/watch?v=abc12345')
  })

  it('rejects non-https or over-long showreel links', () => {
    expect(validateOnboardingPayload({ ...VALID, showreelUrl: 'http://example.com/reel' }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, showreelUrl: 'javascript:alert(1)' }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, showreelUrl: `https://${'x'.repeat(300)}` }).ok).toBe(false)
  })

  it('accepts a complete first credit and treats an all-blank one as skipped', () => {
    const withCredit = validateOnboardingPayload({ ...VALID, firstCredit: { title: ' Lead dancer ', production: 'The Nutcracker' } })
    expect(withCredit.ok).toBe(true)
    if (withCredit.ok) expect(withCredit.value.firstCredit).toEqual({ title: 'Lead dancer', production: 'The Nutcracker' })

    const skipped = validateOnboardingPayload({ ...VALID, firstCredit: { title: '', production: '  ' } })
    expect(skipped.ok).toBe(true)
    if (skipped.ok) expect(skipped.value.firstCredit).toBeNull()
  })

  it('rejects a half-filled or malformed first credit', () => {
    expect(validateOnboardingPayload({ ...VALID, firstCredit: { title: 'Lead dancer', production: '' } }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, firstCredit: { title: '', production: 'The Nutcracker' } }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, firstCredit: 'Lead dancer' }).ok).toBe(false)
    expect(validateOnboardingPayload({ ...VALID, firstCredit: { title: 'x'.repeat(121), production: 'Show' } }).ok).toBe(false)
  })
})
