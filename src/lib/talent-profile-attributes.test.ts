import { describe, expect, it } from 'vitest'
import { validateTalentAttributesPayload } from './talent-profile-attributes'

describe('talent profile attribute validation', () => {
  it('normalises a complete profile payload', () => {
    const result = validateTalentAttributesPayload({
      birth_year: 1994,
      gender: 'non_binary',
      height_cm: 178,
      rate_min: 300,
      rate_max: 500,
      languages: ['English', 'British Sign Language'],
      nationalities: ['British'],
      available_now: true,
      public_attributes: { own_transport: ['car'], overseas_hire: false },
      sensitive_preferences: { nudity: false },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.languages).toEqual(['english', 'british_sign_language'])
    expect(result.value.public_attributes).toEqual({ own_transport: ['car'], overseas_hire: false })
  })

  it('rejects public keys in the restricted preferences object', () => {
    expect(validateTalentAttributesPayload({
      public_attributes: {},
      sensitive_preferences: { hair_colour: true },
    })).toEqual({ ok: false, error: 'Unknown sensitive preference: hair_colour' })
  })

  it('rejects an inverted rate range', () => {
    expect(validateTalentAttributesPayload({
      rate_min: 500,
      rate_max: 200,
      public_attributes: {},
      sensitive_preferences: {},
    }).ok).toBe(false)
  })
})
