import type { Credit, Job, PortfolioItem, Profile, TalentProfileAttributes, TalentSensitivePreferences, TalentSkill } from '@/types'
import type { SearchFilters, SearchFilterValue } from '@/lib/search-filters'
import { FILTER_BY_KEY } from '@/lib/filter-taxonomy'

export type DemoJob = Job & { hirer?: { full_name: string } | null }
export const DEMO_APPLICATIONS_STORAGE_KEY = 'atlas_demo_applications'

export interface DemoApplication {
  id: string
  job_id: string
  note: string
  status: 'sent'
  created_at: string
}

export const DEMO_PROFILE: Profile & {
  talent_skills: TalentSkill[]
  credits: Credit[]
  portfolio_items: PortfolioItem[]
} = {
  id: 'demo-talent',
  account_type: 'talent',
  full_name: 'Priya Singh',
  email: 'priya.singh@atlas-demo.com',
  avatar_url: null,
  cover_url: null,
  headline: 'Bollywood Dancer | Choreographer',
  city: 'London',
  country: 'UK',
  bio: 'Professional Bollywood and Kathak dancer with 12 years of performance experience. Available for music videos, live events, and commercial shoots.',
  rates: '£300 per day / £180 half day',
  availability: 'Available December and January',
  showreel_url: null,
  created_at: '2026-07-10T08:00:00.000Z',
  talent_skills: [
    { id: 'demo-skill-1', profile_id: 'demo-talent', category: 'dancer', skill: 'Bollywood', proficiency: 'expert', created_at: '2026-07-10T08:00:00.000Z' },
    { id: 'demo-skill-2', profile_id: 'demo-talent', category: 'dancer', skill: 'Kathak', proficiency: 'advanced', created_at: '2026-07-10T08:00:00.000Z' },
    { id: 'demo-skill-3', profile_id: 'demo-talent', category: 'dancer', skill: 'Classical Indian dance', proficiency: 'advanced', created_at: '2026-07-10T08:00:00.000Z' },
  ],
  credits: [],
  portfolio_items: [],
}

function createDemoTalent({
  id,
  fullName,
  headline,
  city,
  country = 'UK',
  category,
  skills,
  availability,
  bio,
  rates,
}: {
  id: string
  fullName: string
  headline: string
  city: string
  country?: string
  category: TalentSkill['category']
  skills: Array<{ skill: string; proficiency: TalentSkill['proficiency'] }>
  availability: string
  bio: string
  rates: string
}): Profile & { talent_skills: TalentSkill[] } {
  const createdAt = '2026-07-10T08:00:00.000Z'
  return {
    id,
    account_type: 'talent',
    full_name: fullName,
    email: `${id}@atlas-demo.com`,
    avatar_url: null,
    cover_url: null,
    headline,
    city,
    country,
    bio,
    rates,
    availability,
    showreel_url: null,
    created_at: createdAt,
    talent_skills: skills.map((item, index) => ({
      id: `${id}-skill-${index + 1}`,
      profile_id: id,
      category,
      skill: item.skill,
      proficiency: item.proficiency,
      created_at: createdAt,
    })),
  }
}

export const DEMO_TALENT_RESULTS = [
  DEMO_PROFILE,
  createDemoTalent({
    id: 'demo-talent-2',
    fullName: 'Aisha Khan',
    headline: 'Bollywood Performer | Movement Director',
    city: 'London',
    category: 'dancer',
    skills: [
      { skill: 'Bollywood', proficiency: 'expert' },
      { skill: 'Bhangra', proficiency: 'advanced' },
      { skill: 'Commercial', proficiency: 'advanced' },
    ],
    availability: 'Available in December',
    bio: 'Bollywood performer and movement director experienced across commercials, music videos, and live productions.',
    rates: '£350 per day',
  }),
  createDemoTalent({
    id: 'demo-talent-3',
    fullName: 'Maya Patel',
    headline: 'Dancer | Choreographer | Camera Performance',
    city: 'Manchester',
    category: 'dancer',
    skills: [
      { skill: 'Bollywood', proficiency: 'advanced' },
      { skill: 'Kathak', proficiency: 'expert' },
      { skill: 'Camera performance', proficiency: 'advanced' },
    ],
    availability: 'Limited in December',
    bio: 'A precise, expressive performer with a classical Indian dance foundation and strong on-camera presence.',
    rates: '£280 per day',
  }),
  createDemoTalent({
    id: 'demo-talent-4',
    fullName: 'Leila Morgan',
    headline: 'Actor | Voice Artist | Presenter',
    city: 'London',
    category: 'actor',
    skills: [
      { skill: 'Screen acting', proficiency: 'expert' },
      { skill: 'Voiceover', proficiency: 'advanced' },
      { skill: 'Commercial', proficiency: 'advanced' },
    ],
    availability: 'Available now',
    bio: 'Screen actor and presenter working across branded content, commercials, and short-form film.',
    rates: '£400 per day',
  }),
  createDemoTalent({
    id: 'demo-talent-5',
    fullName: 'Nia Okafor',
    headline: 'Content Creator | Director | Host',
    city: 'Bristol',
    category: 'content_creator',
    skills: [
      { skill: 'Lifestyle content', proficiency: 'expert' },
      { skill: 'On-camera hosting', proficiency: 'advanced' },
      { skill: 'Short-form video', proficiency: 'expert' },
    ],
    availability: 'Available in December',
    bio: 'Creator and host producing warm, high-energy social content for culture, lifestyle, and beauty brands.',
    rates: '£500 per project',
  }),
  createDemoTalent({
    id: 'demo-talent-6',
    fullName: 'Ravi Mehta',
    headline: 'Actor | Dancer | Stunt Performer',
    city: 'London',
    category: 'actor',
    skills: [
      { skill: 'Hindi', proficiency: 'expert' },
      { skill: 'Screen acting', proficiency: 'advanced' },
      { skill: 'Movement', proficiency: 'advanced' },
    ],
    availability: 'Available in December',
    bio: 'Hindi-speaking actor and movement performer with commercial, narrative, and live experience.',
    rates: '£325 per day',
  }),
  createDemoTalent({
    id: 'demo-talent-7',
    fullName: 'Sofia Williams',
    headline: 'Contemporary Dancer | Movement Coach',
    city: 'Leeds',
    category: 'dancer',
    skills: [
      { skill: 'Contemporary', proficiency: 'expert' },
      { skill: 'Improvisation', proficiency: 'advanced' },
      { skill: 'Movement direction', proficiency: 'advanced' },
    ],
    availability: 'Available now',
    bio: 'Contemporary dancer and movement coach for music videos, fashion films, and live performance.',
    rates: '£300 per day',
  }),
  createDemoTalent({
    id: 'demo-talent-8',
    fullName: 'Theo Brooks',
    headline: 'Photographer | Director | Visual Storyteller',
    city: 'London',
    category: 'photographer_videographer',
    skills: [
      { skill: 'Fashion content', proficiency: 'expert' },
      { skill: 'Photography', proficiency: 'expert' },
      { skill: 'Art direction', proficiency: 'advanced' },
    ],
    availability: 'Available in December',
    bio: 'Visual storyteller creating distinctive fashion and culture work for brands, artists, and editorial teams.',
    rates: '£450 per day',
  }),
] as Array<Profile & { talent_skills: TalentSkill[] }>

export type DemoTalentAttributes = Omit<TalentProfileAttributes, 'profile_id' | 'updated_at'> & {
  sensitive_preferences: TalentSensitivePreferences['preferences']
}

const demoAttribute = (overrides: Partial<DemoTalentAttributes> = {}): DemoTalentAttributes => ({
  birth_year: 1995,
  gender: null,
  height_cm: null,
  rate_min: 250,
  rate_max: 500,
  rate_unit: 'day',
  rate_currency: 'GBP',
  languages: ['english'],
  nationalities: ['british'],
  available_now: false,
  public_attributes: {},
  sensitive_preferences: {},
  ...overrides,
})

export const DEMO_TALENT_ATTRIBUTES: Record<string, DemoTalentAttributes> = {
  'demo-talent': demoAttribute({ birth_year: 1993, gender: 'female', height_cm: 165, rate_min: 180, rate_max: 300, languages: ['english', 'hindi'], available_now: true, public_attributes: { overseas_hire: true, own_transport: ['car'], passport: ['uk'], dance_skill_level: ['advanced_or_professional'], experienced_choreographer: true, dance_experience: ['music_videos', 'live_performance', 'choreography'] } }),
  'demo-talent-2': demoAttribute({ birth_year: 1990, gender: 'female', height_cm: 170, languages: ['english', 'urdu'], available_now: true, public_attributes: { overseas_hire: true, dance_skill_level: ['advanced_or_professional'], experienced_choreographer: true } }),
  'demo-talent-3': demoAttribute({ birth_year: 1998, gender: 'female', height_cm: 162, languages: ['english', 'gujarati'], public_attributes: { dance_skill_level: ['advanced_or_professional'], dance_experience: ['stage', 'music_videos'] } }),
  'demo-talent-4': demoAttribute({ birth_year: 1991, gender: 'female', height_cm: 174, available_now: true, public_attributes: { acting_medium: ['screen_acting', 'voice_acting'], acting_technique: ['meisner_technique'], actor_type: ['character_actor'], spact: false, accents: ['cockney'] }, sensitive_preferences: { kissing_scene: true, smoking_scene: false, nudity: false, implied_nudity: true, partial_clothing: true } }),
  'demo-talent-5': demoAttribute({ birth_year: 1996, gender: 'female', public_attributes: { overseas_hire: true, own_transport: ['car'] } }),
  'demo-talent-6': demoAttribute({ birth_year: 1989, gender: 'male', height_cm: 182, languages: ['english', 'hindi'], available_now: true, public_attributes: { acting_medium: ['screen_acting'], spact: true, spact_types: ['martial_artist'], stunt_register: false, stunt_disciplines: ['martial_arts'] }, sensitive_preferences: { kissing_scene: true, smoking_scene: true, nudity: false, implied_nudity: true, partial_clothing: true } }),
  'demo-talent-7': demoAttribute({ birth_year: 1994, gender: 'female', height_cm: 168, available_now: true, public_attributes: { dance_skill_level: ['advanced_or_professional'], experienced_choreographer: false, dance_experience: ['live_performance', 'teaching'] } }),
  'demo-talent-8': demoAttribute({ birth_year: 1992, gender: 'male', rate_min: 450, rate_max: 900, available_now: true, public_attributes: { photography_camera_format: ['full_frame'], photography_equipment: ['sony', 'leica'], videography_equipment: ['sony', 'blackmagic'], netflix_approved_camera: true, photography_types: ['fashion', 'editorial', 'portrait'], videography_types: ['commercial', 'cinematic'], delivery_time: ['14_days'], overseas_hire: true } }),
}

function rangeMatches(value: number | null, range: SearchFilterValue) {
  if (value === null || typeof range !== 'object' || Array.isArray(range)) return false
  return (range.min === undefined || value >= range.min) && (range.max === undefined || value <= range.max)
}

function attributeMatches(actual: unknown, requested: SearchFilterValue) {
  if (Array.isArray(requested)) {
    const actualValues = Array.isArray(actual) ? actual : actual == null ? [] : [actual]
    return requested.some(value => actualValues.includes(value))
  }
  if (typeof requested === 'boolean') return actual === requested
  if (typeof requested === 'string') return String(actual ?? '').toLowerCase().includes(requested.toLowerCase())
  return false
}

export function filterDemoTalent(filters: SearchFilters) {
  const year = new Date().getUTCFullYear()
  return DEMO_TALENT_RESULTS.filter(profile => {
    const attributes = DEMO_TALENT_ATTRIBUTES[profile.id] ?? demoAttribute()
    for (const [key, requested] of Object.entries(filters)) {
      if (requested === undefined) continue
      if (key === 'category' && !profile.talent_skills.some(skill => skill.category === requested)) return false
      if (key === 'location' && !`${profile.city ?? ''} ${profile.country ?? ''}`.toLowerCase().includes(String(requested).toLowerCase())) return false
      if (key === 'available_now' && attributes.available_now !== requested) return false
      if (key === 'age' && !rangeMatches(attributes.birth_year === null ? null : year - attributes.birth_year, requested)) return false
      if (key === 'height' && !rangeMatches(attributes.height_cm, requested)) return false
      if (key === 'rate' && typeof requested === 'object' && !Array.isArray(requested)) {
        if (requested.min !== undefined && (attributes.rate_max === null || attributes.rate_max < requested.min)) return false
        if (requested.max !== undefined && (attributes.rate_min === null || attributes.rate_min > requested.max)) return false
      }
      if (key === 'gender' && (!Array.isArray(requested) || !attributes.gender || !requested.includes(attributes.gender))) return false
      if (key === 'languages' && (!Array.isArray(requested) || !requested.some(value => attributes.languages.includes(value)))) return false
      if (key === 'nationalities' && (!Array.isArray(requested) || !requested.some(value => attributes.nationalities.includes(value)))) return false
      if (key === 'dance_styles' && (!Array.isArray(requested) || !requested.some(value => profile.talent_skills.some(skill => normaliseDemoSearch(skill.skill).replace(/ /g, '_') === value)))) return false
      const definition = FILTER_BY_KEY.get(key)
      if (definition?.storage === 'public_attributes' && !attributeMatches(attributes.public_attributes[key], requested)) return false
      if (definition?.storage === 'sensitive_preferences' && !attributeMatches(attributes.sensitive_preferences[key], requested)) return false
    }
    return true
  })
}

function normaliseDemoSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function searchDemoTalent(query: string, filters: SearchFilters = {}) {
  const terms = normaliseDemoSearch(query).split(' ').filter(term => term.length > 2)

  return filterDemoTalent(filters)
    .map(profile => {
      const searchable = normaliseDemoSearch([
        profile.full_name,
        profile.headline,
        profile.city,
        profile.country,
        profile.bio,
        profile.availability,
        ...profile.talent_skills.map(skill => skill.skill),
      ].filter(Boolean).join(' '))
      const matchedTerms = terms.filter(term => searchable.includes(term))
      const hasLocationMatch = terms.some(term => normaliseDemoSearch(`${profile.city} ${profile.country}`).includes(term))
      const hasAvailabilityMatch = terms.some(term => normaliseDemoSearch(profile.availability ?? '').includes(term))
      const hasSkillMatch = profile.talent_skills.some(skill => terms.some(term => normaliseDemoSearch(skill.skill).includes(term)))
      const matchScore = Math.min(98, Math.max(58, 58 + matchedTerms.length * 7 + (hasLocationMatch ? 8 : 0) + (hasAvailabilityMatch ? 7 : 0) + (hasSkillMatch ? 5 : 0)))
      const matchReasons = [
        hasSkillMatch ? 'Relevant skills' : null,
        hasLocationMatch ? `Based in ${profile.city}` : null,
        hasAvailabilityMatch ? profile.availability : null,
        profile.talent_skills.length > 0 ? `${profile.talent_skills.length} skills listed` : null,
      ].filter((reason): reason is string => Boolean(reason)).slice(0, 3)

      return { profile, match_score: matchScore, match_reasons: matchReasons }
    })
    .sort((a, b) => b.match_score - a.match_score)
}

export const DEMO_JOBS: DemoJob[] = [
  {
    id: 'demo-job-1',
    hirer_id: 'demo-hirer',
    title: 'Bollywood campaign dancers',
    description: 'Looking for expressive Bollywood dancers for a bright, high-energy campaign shoot in London. Strong performance quality and comfort on camera are essential.',
    category: 'dancer',
    skills_required: ['Bollywood', 'Commercial', 'Camera performance'],
    location: 'London, UK',
    budget: '£300 per day',
    status: 'open',
    created_at: '2026-07-10T08:00:00.000Z',
    work_type: 'in_person',
    start_date: '2026-12-05',
    end_date: '2026-12-06',
    application_deadline: '2026-11-20',
    duration: '2 shoot days',
    usage_rights: '12 months, UK digital campaign',
    travel_required: false,
    hirer: { full_name: 'Northstar Studios' },
  },
  {
    id: 'demo-job-2',
    hirer_id: 'demo-hirer',
    title: 'Dance-led music video',
    description: 'A new music video needs a confident dancer with a contemporary edge and strong improvisation skills. Rehearsal and shoot dates are flexible this month.',
    category: 'dancer',
    skills_required: ['Contemporary', 'Improvisation', 'Music video'],
    location: 'East London',
    budget: '£250 per day',
    status: 'open',
    created_at: '2026-07-09T10:30:00.000Z',
    work_type: 'in_person',
    start_date: '2026-08-28',
    end_date: '2026-08-30',
    application_deadline: '2026-08-10',
    duration: '3 rehearsal and shoot days',
    usage_rights: 'Music video release and social clips',
    travel_required: false,
    hirer: { full_name: 'Cobalt Films' },
  },
  {
    id: 'demo-job-3',
    hirer_id: 'demo-hirer',
    title: 'Cultural festival performance',
    description: 'Seeking a polished performer for a live cultural festival showcase. The ideal candidate brings warmth, precision, and experience working with an ensemble.',
    category: 'dancer',
    skills_required: ['Live performance', 'Folk dance', 'Ensemble'],
    location: 'Southbank, London',
    budget: '£220 per day',
    status: 'open',
    created_at: '2026-07-08T14:15:00.000Z',
    work_type: 'in_person',
    start_date: '2026-09-19',
    end_date: '2026-09-19',
    application_deadline: '2026-08-25',
    duration: '1 performance day',
    usage_rights: 'Event documentation and festival promotion',
    travel_required: true,
    hirer: { full_name: 'Common Ground Events' },
  },
]
