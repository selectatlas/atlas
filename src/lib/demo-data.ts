import type { Credit, Job, PortfolioItem, Profile, TalentSkill } from '@/types'

export type DemoJob = Job & { hirer?: { full_name: string } | null }
export const DEMO_APPLICATIONS_STORAGE_KEY = 'castd_demo_applications'

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
  email: 'priya.singh@castd-demo.com',
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
    email: `${id}@castd-demo.com`,
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
    headline: 'Creator | Photographer | Visual Storyteller',
    city: 'London',
    category: 'content_creator',
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

function normaliseDemoSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function searchDemoTalent(query: string) {
  const terms = normaliseDemoSearch(query).split(' ').filter(term => term.length > 2)

  return DEMO_TALENT_RESULTS
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
