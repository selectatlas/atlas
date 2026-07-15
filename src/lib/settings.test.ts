import { describe, expect, it } from 'vitest'
import {
  normalizeNotificationPreferences,
  validateSettingsPatch,
} from './settings'

describe('settings validation', () => {
  it('accepts talent visibility + notification updates', () => {
    const result = validateSettingsPatch(
      {
        profile_visibility: 'private',
        notification_preferences: {
          messages: { in_app: true, email: false },
        },
      },
      'talent',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.profile_visibility).toBe('private')
    expect(result.value.notification_preferences?.messages.email).toBe(false)
  })

  it('rejects talent trying to set job defaults', () => {
    const result = validateSettingsPatch(
      { job_defaults: { category: 'dancer', location: 'London', budget: null, skills_required: [] } },
      'talent',
    )
    expect(result.ok).toBe(false)
  })

  it('accepts hirer job and outreach defaults', () => {
    const result = validateSettingsPatch(
      {
        job_defaults: {
          category: 'actor',
          location: 'Manchester',
          budget: '£400/day',
          skills_required: ['Drama'],
        },
        outreach_defaults: { tone_context: 'for a commercial casting brief' },
      },
      'hirer',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.job_defaults?.category).toBe('actor')
    expect(result.value.outreach_defaults?.tone_context).toContain('commercial')
  })

  it('fills missing notification channels with defaults', () => {
    const prefs = normalizeNotificationPreferences({
      messages: { in_app: false, email: false },
    })
    expect(prefs.messages.in_app).toBe(false)
    expect(prefs.applications.in_app).toBe(true)
  })
})
