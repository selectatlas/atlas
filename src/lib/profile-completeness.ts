import type { Credit, PortfolioItem, Profile, TalentSkill } from '@/types'
import type { TalentAttributesPayload } from '@/lib/talent-profile-attributes'

type TalentProfile = Profile & {
  talent_skills: TalentSkill[]
  credits?: Credit[]
  portfolio_items?: PortfolioItem[]
}

export interface ProfileCompletenessItem {
  key: string
  label: string
  hint: string
  complete: boolean
  weight: number
}

export function getProfileCompleteness(profile: TalentProfile, attributes?: TalentAttributesPayload) {
  const searchDetailCount = attributes ? [
    attributes.birth_year,
    attributes.gender,
    attributes.height_cm,
    attributes.rate_min,
    attributes.available_now,
    attributes.languages.length > 0,
    attributes.nationalities.length > 0,
    Object.keys(attributes.public_attributes).length > 0,
  ].filter(value => value !== null && value !== false).length : 0
  const items: ProfileCompletenessItem[] = [
    { key: 'photo', label: 'Add a profile photo', hint: 'Profiles with a face are easier to trust.', complete: Boolean(profile.avatar_url), weight: 12 },
    { key: 'headline', label: 'Write a clear headline', hint: 'Say what you do in the words hirers search for.', complete: Boolean(profile.headline?.trim()), weight: 12 },
    { key: 'bio', label: 'Introduce your work', hint: 'A short story helps the right brief find you.', complete: Boolean(profile.bio?.trim()), weight: 12 },
    { key: 'location', label: 'Add your location', hint: 'Location helps hirers plan shoots and travel.', complete: Boolean(profile.city?.trim() && profile.country?.trim()), weight: 10 },
    { key: 'skills', label: 'Add your strongest skills', hint: 'Skills improve matching and search visibility.', complete: profile.talent_skills.length >= 3, weight: 14 },
    { key: 'work', label: 'Show proof of work', hint: 'Add a showreel, portfolio item, or credit.', complete: Boolean(profile.showreel_url || profile.portfolio_items?.length || profile.credits?.length), weight: 14 },
    { key: 'availability', label: 'Keep availability current', hint: 'Hirers need to know when they can book you.', complete: Boolean(profile.availability?.trim()), weight: 8 },
    { key: 'rates', label: 'Set an indicative rate', hint: 'Even a range helps set expectations early.', complete: Boolean(profile.rates?.trim()), weight: 4 },
    { key: 'search-details', label: 'Add casting and search details', hint: 'Structured details make your profile discoverable with precise filters.', complete: searchDetailCount >= 3, weight: 14 },
  ]

  const score = items.reduce((total, item) => total + (item.complete ? item.weight : 0), 0)
  return { score, items, missing: items.filter(item => !item.complete) }
}
