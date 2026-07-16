import { FILTER_BY_KEY } from '@/lib/filter-taxonomy'
import { parseSearchFilterObject } from '@/lib/search-filters'
import type { TalentProfileAttributes, TalentSensitivePreferences } from '@/types'

// response_time_hours is deliberately excluded: it is a server-managed stat
// (seeded / computed), never writable through the attributes PATCH payload.
export type TalentAttributesPayload = Omit<TalentProfileAttributes, 'profile_id' | 'updated_at' | 'response_time_hours'> & {
  sensitive_preferences: TalentSensitivePreferences['preferences']
}

export const EMPTY_TALENT_ATTRIBUTES: TalentAttributesPayload = {
  birth_year: null,
  gender: null,
  height_cm: null,
  rate_min: null,
  rate_max: null,
  rate_unit: 'day',
  rate_currency: 'GBP',
  languages: [],
  nationalities: [],
  available_now: null,
  public_attributes: {},
  sensitive_preferences: {},
}

type AttributeValidationResult =
  | { ok: true; value: TalentAttributesPayload }
  | { ok: false; error: string }

function nullableInteger(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : undefined
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return null
  const values = [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
    .filter(Boolean))]
  return values.length <= 30 ? values : null
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function validateTalentAttributesPayload(input: unknown): AttributeValidationResult {
  const source = objectValue(input)
  if (!source) return { ok: false, error: 'Profile attributes must be an object' }

  const currentYear = new Date().getUTCFullYear()
  const birthYear = nullableInteger(source.birth_year, 1900, currentYear)
  const height = nullableInteger(source.height_cm, 100, 230)
  const rateMin = nullableInteger(source.rate_min, 0, 20000)
  const rateMax = nullableInteger(source.rate_max, 0, 20000)
  if (birthYear === undefined) return { ok: false, error: 'Invalid birth year' }
  if (height === undefined) return { ok: false, error: 'Invalid height' }
  if (rateMin === undefined || rateMax === undefined || (rateMin !== null && rateMax !== null && rateMin > rateMax)) {
    return { ok: false, error: 'Invalid day rate range' }
  }

  const gender = source.gender === null || source.gender === undefined || source.gender === ''
    ? null
    : typeof source.gender === 'string' && ['male', 'female', 'non_binary'].includes(source.gender)
      ? source.gender as TalentAttributesPayload['gender']
      : undefined
  if (gender === undefined) return { ok: false, error: 'Invalid gender' }

  const languages = stringList(source.languages ?? [])
  const nationalities = stringList(source.nationalities ?? [])
  if (!languages || !nationalities) return { ok: false, error: 'Languages and nationalities must be lists of at most 30 values' }

  const availableNow = source.available_now === null || source.available_now === undefined
    ? null
    : typeof source.available_now === 'boolean' ? source.available_now : undefined
  if (availableNow === undefined) return { ok: false, error: 'Invalid availability' }

  const publicInput = objectValue(source.public_attributes ?? {})
  if (!publicInput) return { ok: false, error: 'Public attributes must be an object' }
  for (const key of Object.keys(publicInput)) {
    if (FILTER_BY_KEY.get(key)?.storage !== 'public_attributes') return { ok: false, error: `Unknown public attribute: ${key}` }
  }
  const parsedPublic = parseSearchFilterObject(publicInput)
  if (!parsedPublic.ok) return { ok: false, error: parsedPublic.error }

  const sensitiveInput = objectValue(source.sensitive_preferences ?? {})
  if (!sensitiveInput) return { ok: false, error: 'Sensitive preferences must be an object' }
  const sensitive: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(sensitiveInput)) {
    if (FILTER_BY_KEY.get(key)?.storage !== 'sensitive_preferences') return { ok: false, error: `Unknown sensitive preference: ${key}` }
    if (value === null || value === undefined) continue
    if (typeof value !== 'boolean') return { ok: false, error: `Invalid sensitive preference: ${key}` }
    sensitive[key] = value
  }

  return {
    ok: true,
    value: {
      birth_year: birthYear,
      gender,
      height_cm: height,
      rate_min: rateMin,
      rate_max: rateMax,
      rate_unit: 'day',
      rate_currency: 'GBP',
      languages,
      nationalities,
      available_now: availableNow,
      public_attributes: parsedPublic.filters as unknown as TalentProfileAttributes['public_attributes'],
      sensitive_preferences: sensitive,
    },
  }
}
