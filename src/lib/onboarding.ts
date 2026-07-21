import { SKILLS_BY_CATEGORY } from '@/lib/skills'
import type { Category, Profile, TalentSkill } from '@/types'

export type OnboardingProfile = Pick<Profile, 'headline'> & {
  talent_skills?: Array<Pick<TalentSkill, 'id'>> | null
}

// A talent profile with neither a headline nor any skills has not been through
// onboarding - both are written by the wizard before it completes. Used to
// route fresh signups into /onboarding and returning users past it.
export function needsOnboarding(profile: OnboardingProfile | null | undefined): boolean {
  if (!profile) return true
  return !profile.headline?.trim() && (profile.talent_skills?.length ?? 0) === 0
}

export const MAX_ONBOARDING_SKILLS = 10

export type OnboardingPayload = {
  category: Category
  skills: string[]
  headline: string
  bio: string | null
  city: string | null
  country: string | null
  rates: string | null
  availability: string | null
  availableNow: boolean | null
  showreelUrl: string | null
  firstCredit: { title: string; production: string } | null
}

type OnboardingValidationResult =
  | { ok: true; value: OnboardingPayload }
  | { ok: false; error: string }

// Returns the trimmed text, null when absent/blank, or undefined when invalid.
function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.length <= maxLength ? trimmed : undefined
}

export function validateOnboardingPayload(input: unknown): OnboardingValidationResult {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : null
  if (!source) return { ok: false, error: 'Onboarding details must be an object' }

  const category = typeof source.category === 'string' && source.category in SKILLS_BY_CATEGORY
    ? source.category as Category
    : null
  if (!category) return { ok: false, error: 'Pick a category' }

  if (!Array.isArray(source.skills)) return { ok: false, error: 'Pick at least one skill' }
  const skills = [...new Set(source.skills
    .filter((skill): skill is string => typeof skill === 'string')
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0 && skill.length <= 60))]
  if (skills.length === 0) return { ok: false, error: 'Pick at least one skill' }
  if (skills.length > MAX_ONBOARDING_SKILLS) {
    return { ok: false, error: `Pick at most ${MAX_ONBOARDING_SKILLS} skills` }
  }

  const headline = typeof source.headline === 'string' ? source.headline.trim() : ''
  if (!headline) return { ok: false, error: 'Add a headline' }
  if (headline.length > 120) return { ok: false, error: 'Headline must be 120 characters or fewer' }

  const bio = optionalText(source.bio, 2000)
  if (bio === undefined) return { ok: false, error: 'Bio must be 2000 characters or fewer' }
  const city = optionalText(source.city, 80)
  const country = optionalText(source.country, 80)
  if (city === undefined || country === undefined) {
    return { ok: false, error: 'Location must be 80 characters or fewer' }
  }
  const rates = optionalText(source.rates, 120)
  if (rates === undefined) return { ok: false, error: 'Rates must be 120 characters or fewer' }

  const availability = optionalText(source.availability, 200)
  if (availability === undefined) return { ok: false, error: 'Availability must be 200 characters or fewer' }

  const availableNow = source.availableNow === null || source.availableNow === undefined
    ? null
    : typeof source.availableNow === 'boolean' ? source.availableNow : undefined
  if (availableNow === undefined) return { ok: false, error: 'Invalid availability' }

  const showreelUrl = optionalText(source.showreelUrl, 300)
  if (showreelUrl === undefined) return { ok: false, error: 'Showreel link must be 300 characters or fewer' }
  if (showreelUrl !== null && !/^https:\/\//.test(showreelUrl)) {
    return { ok: false, error: 'Showreel link must start with https://' }
  }

  let firstCredit: OnboardingPayload['firstCredit'] = null
  if (source.firstCredit !== null && source.firstCredit !== undefined) {
    const creditSource = typeof source.firstCredit === 'object' && !Array.isArray(source.firstCredit)
      ? source.firstCredit as Record<string, unknown>
      : null
    if (!creditSource) return { ok: false, error: 'Invalid first credit' }
    const title = optionalText(creditSource.title, 120)
    const production = optionalText(creditSource.production, 120)
    if (title === undefined || production === undefined) {
      return { ok: false, error: 'Credit details must be 120 characters or fewer' }
    }
    // Both blank means the step was skipped; one without the other is an error.
    if (title !== null || production !== null) {
      if (!title || !production) return { ok: false, error: 'A credit needs both a role and a production' }
      firstCredit = { title, production }
    }
  }

  return { ok: true, value: { category, skills, headline, bio, city, country, rates, availability, availableNow, showreelUrl, firstCredit } }
}
