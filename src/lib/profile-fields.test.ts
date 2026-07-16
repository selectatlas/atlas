import { describe, expect, it } from 'vitest'
import { PUBLIC_PROFILE_FIELDS, PUBLIC_PROFILE_WITH_SKILLS } from './profile-fields'

describe('public profile projections', () => {
  it('never requests private identity fields or wildcards', () => {
    expect(PUBLIC_PROFILE_FIELDS.split(',').map(field => field.trim())).not.toContain('email')
    expect(PUBLIC_PROFILE_WITH_SKILLS).not.toContain('*')
  })

  it('includes verification fields granted in migration 015', () => {
    const fields = PUBLIC_PROFILE_FIELDS.split(',').map(field => field.trim())
    expect(fields).toContain('verified_at')
    expect(fields).toContain('verified_categories')
    expect(PUBLIC_PROFILE_WITH_SKILLS).toContain('verified_at')
  })
})
