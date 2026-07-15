import { cleanOptionalString, cleanStringArray } from '@/lib/validation'
import type { Category, HirerJobDefaults, HirerOutreachDefaults, NotificationChannelPrefs, NotificationPreferences, ProfileVisibility } from '@/types'

export const PROFILE_VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; label: string; description: string }> = [
  {
    value: 'public',
    label: 'Public to hirers',
    description: 'Eligible for Atlas search and discovery by authenticated hirers.',
  },
  {
    value: 'members',
    label: 'Hirers only',
    description: 'Visible to signed-in hirers in search. Hidden from other talent profiles.',
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Hidden from search and discovery. Only you can open your profile.',
  },
]

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: { in_app: true, email: true },
  applications: { in_app: true, email: true },
  outreach: { in_app: true, email: true },
  job_matches: { in_app: true, email: false },
  shortlist: { in_app: true, email: true },
}

export const DEFAULT_HIRER_JOB_DEFAULTS: HirerJobDefaults = {
  category: null,
  location: null,
  budget: null,
  skills_required: [],
}

export const DEFAULT_HIRER_OUTREACH_DEFAULTS: HirerOutreachDefaults = {
  tone_context: null,
}

const CATEGORIES: Category[] = ['dancer', 'actor', 'photographer_videographer', 'content_creator']
const VISIBILITIES: ProfileVisibility[] = ['public', 'members', 'private']
const NOTIFICATION_KEYS = ['messages', 'applications', 'outreach', 'job_matches', 'shortlist'] as const

function asChannel(value: unknown, fallback: NotificationChannelPrefs): NotificationChannelPrefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  const record = value as Record<string, unknown>
  return {
    in_app: typeof record.in_app === 'boolean' ? record.in_app : fallback.in_app,
    email: typeof record.email === 'boolean' ? record.email : fallback.email,
  }
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  return {
    messages: asChannel(record.messages, DEFAULT_NOTIFICATION_PREFERENCES.messages),
    applications: asChannel(record.applications, DEFAULT_NOTIFICATION_PREFERENCES.applications),
    outreach: asChannel(record.outreach, DEFAULT_NOTIFICATION_PREFERENCES.outreach),
    job_matches: asChannel(record.job_matches, DEFAULT_NOTIFICATION_PREFERENCES.job_matches),
    shortlist: asChannel(record.shortlist, DEFAULT_NOTIFICATION_PREFERENCES.shortlist),
  }
}

export function normalizeHirerJobDefaults(value: unknown): HirerJobDefaults {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const category = typeof record.category === 'string' && CATEGORIES.includes(record.category as Category)
    ? record.category as Category
    : null
  const location = typeof record.location === 'string' && record.location.trim()
    ? record.location.trim().slice(0, 120)
    : null
  const budget = typeof record.budget === 'string' && record.budget.trim()
    ? record.budget.trim().slice(0, 120)
    : null
  const skills = Array.isArray(record.skills_required)
    ? record.skills_required.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(s => s.trim().slice(0, 80)).slice(0, 20)
    : []
  return { category, location, budget, skills_required: skills }
}

export function normalizeHirerOutreachDefaults(value: unknown): HirerOutreachDefaults {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const tone = typeof record.tone_context === 'string' && record.tone_context.trim()
    ? record.tone_context.trim().slice(0, 500)
    : null
  return { tone_context: tone }
}

export function isProfileVisibility(value: unknown): value is ProfileVisibility {
  return typeof value === 'string' && VISIBILITIES.includes(value as ProfileVisibility)
}

export type SettingsPatchValue = {
  profile_visibility?: ProfileVisibility
  notification_preferences?: NotificationPreferences
  job_defaults?: HirerJobDefaults
  outreach_defaults?: HirerOutreachDefaults
}

export type SettingsPatchResult =
  | { ok: true; value: SettingsPatchValue }
  | { ok: false; error: string }

export function validateSettingsPatch(body: Record<string, unknown>, accountType: 'hirer' | 'talent'): SettingsPatchResult {
  const value: SettingsPatchValue = {}

  if ('profile_visibility' in body) {
    if (accountType !== 'talent') return { ok: false, error: 'Only talent can set profile visibility' }
    if (!isProfileVisibility(body.profile_visibility)) {
      return { ok: false, error: 'Invalid profile_visibility' }
    }
    value.profile_visibility = body.profile_visibility
  }

  if ('notification_preferences' in body) {
    if (!body.notification_preferences || typeof body.notification_preferences !== 'object' || Array.isArray(body.notification_preferences)) {
      return { ok: false, error: 'Invalid notification_preferences' }
    }
    const prefs = body.notification_preferences as Record<string, unknown>
    for (const key of Object.keys(prefs)) {
      if (!NOTIFICATION_KEYS.includes(key as typeof NOTIFICATION_KEYS[number])) {
        return { ok: false, error: `Unknown notification preference: ${key}` }
      }
      const channel = prefs[key]
      if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
        return { ok: false, error: `Invalid channel prefs for ${key}` }
      }
      const record = channel as Record<string, unknown>
      if (typeof record.in_app !== 'boolean' || typeof record.email !== 'boolean') {
        return { ok: false, error: `Channel prefs for ${key} must include boolean in_app and email` }
      }
    }
    value.notification_preferences = normalizeNotificationPreferences(prefs)
  }

  if ('job_defaults' in body) {
    if (accountType !== 'hirer') return { ok: false, error: 'Only hirers can set job defaults' }
    if (!body.job_defaults || typeof body.job_defaults !== 'object' || Array.isArray(body.job_defaults)) {
      return { ok: false, error: 'Invalid job_defaults' }
    }
    const job = body.job_defaults as Record<string, unknown>
    if ('category' in job && job.category !== null && !(typeof job.category === 'string' && CATEGORIES.includes(job.category as Category))) {
      return { ok: false, error: 'Invalid job category' }
    }
    const location = cleanOptionalString(job.location, 120)
    if (!location.ok) return { ok: false, error: 'Invalid job location' }
    const budget = cleanOptionalString(job.budget, 120)
    if (!budget.ok) return { ok: false, error: 'Invalid job budget' }
    const skills = cleanStringArray(job.skills_required ?? [], 20, 80)
    if (skills === null) return { ok: false, error: 'Invalid skills_required' }
    value.job_defaults = {
      category: (job.category as Category | null | undefined) ?? null,
      location: location.value,
      budget: budget.value,
      skills_required: skills,
    }
  }

  if ('outreach_defaults' in body) {
    if (accountType !== 'hirer') return { ok: false, error: 'Only hirers can set outreach defaults' }
    if (!body.outreach_defaults || typeof body.outreach_defaults !== 'object' || Array.isArray(body.outreach_defaults)) {
      return { ok: false, error: 'Invalid outreach_defaults' }
    }
    const outreach = body.outreach_defaults as Record<string, unknown>
    const tone = cleanOptionalString(outreach.tone_context, 500)
    if (!tone.ok) return { ok: false, error: 'Invalid outreach tone_context' }
    value.outreach_defaults = { tone_context: tone.value }
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: 'No settings fields provided' }
  }

  return { ok: true, value }
}
