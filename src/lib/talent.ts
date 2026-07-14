import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { DEMO_PROFILE, DEMO_TALENT_ATTRIBUTES, DEMO_TALENT_RESULTS } from '@/lib/demo-data'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import type { Profile, TalentSkill, Credit, PortfolioItem } from '@/types'
import type { TalentDisplayDetails } from '@/components/talent/TalentProfileDetails'

function displayDetails(attributes: Record<string, unknown> | null | undefined, sensitive?: Record<string, boolean | null>): TalentDisplayDetails {
  const birthYear = typeof attributes?.birth_year === 'number' ? attributes.birth_year : null
  return {
    age: birthYear ? new Date().getUTCFullYear() - birthYear : null,
    gender: typeof attributes?.gender === 'string' ? attributes.gender : null,
    height_cm: typeof attributes?.height_cm === 'number' ? attributes.height_cm : null,
    rate_min: typeof attributes?.rate_min === 'number' ? attributes.rate_min : null,
    rate_max: typeof attributes?.rate_max === 'number' ? attributes.rate_max : null,
    languages: Array.isArray(attributes?.languages) ? attributes.languages as string[] : [],
    nationalities: Array.isArray(attributes?.nationalities) ? attributes.nationalities as string[] : [],
    available_now: typeof attributes?.available_now === 'boolean' ? attributes.available_now : null,
    public_attributes: attributes?.public_attributes && typeof attributes.public_attributes === 'object' ? attributes.public_attributes as Record<string, unknown> : {},
    sensitive_preferences: sensitive,
  }
}

export async function getTalentProfile(id: string) {
  const cookieStore = await cookies()
  const isLocalDemo = process.env.NODE_ENV === 'development' && cookieStore.get('atlas_demo')?.value === '1'

  if (isLocalDemo) {
    const demoProfile = DEMO_TALENT_RESULTS.find(profile => profile.id === id)

    if (demoProfile) {
      const primaryCategory = demoProfile.talent_skills[0]?.category
      const similarTalent = DEMO_TALENT_RESULTS
        .filter(profile => profile.id !== id && profile.talent_skills[0]?.category === primaryCategory)
        .slice(0, 6)
        .map(profile => ({ profile, match_score: 0 }))

      return {
        profile: demoProfile,
        credits: demoProfile.id === DEMO_PROFILE.id ? DEMO_PROFILE.credits : [],
        portfolioItems: demoProfile.id === DEMO_PROFILE.id ? DEMO_PROFILE.portfolio_items : [],
        likesCount: 0,
        viewsCount: 0,
        similarTalent,
        talentDetails: displayDetails(DEMO_TALENT_ATTRIBUTES[id], DEMO_TALENT_ATTRIBUTES[id]?.sensitive_preferences),
      }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .eq('id', id)
    .eq('account_type', 'talent')
    .single()

  if (!profile) return null

  const service = createServiceClient()
  const [{ data: attributes }, { data: callerProfile }] = await Promise.all([
    service.from('talent_profiles').select('*').eq('profile_id', id).maybeSingle(),
    user ? service.from('profiles').select('account_type').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  let sensitivePreferences: Record<string, boolean | null> | undefined
  if (callerProfile?.account_type === 'hirer') {
    const { data: sensitive } = await service.from('talent_sensitive_preferences').select('preferences').eq('profile_id', id).maybeSingle()
    sensitivePreferences = sensitive?.preferences as Record<string, boolean | null> | undefined
  }

  const { data: creditsData } = await supabase
    .from('credits')
    .select('*')
    .eq('profile_id', id)
    .order('sort_order', { ascending: true })
    .order('start_date', { ascending: false })
  const credits = (creditsData ?? []) as Credit[]

  const { data: portfolioData } = await supabase
    .from('portfolio_items')
    .select('*')
    .eq('profile_id', id)
    .order('sort_order', { ascending: true })
  const portfolioItems = (portfolioData ?? []) as PortfolioItem[]

  let likesCount = 0
  let viewsCount = 0
  try {
    const { data: stats } = await supabase
      .from('talent_stats')
      .select('*')
      .eq('profile_id', id)
      .single()
    if (stats) {
      likesCount = (stats as Record<string, number>).likes_count ?? 0
      viewsCount = (stats as Record<string, number>).views_count ?? 0
    }
  } catch {
    // Stats view may not exist yet
  }

  const skills = profile.talent_skills as TalentSkill[]
  const primaryCategory = skills[0]?.category ?? null
  
  let similarTalent: Array<{ profile: Profile & { talent_skills: TalentSkill[] }; match_score: number }> = []
  if (primaryCategory) {
    const { data: similar } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_WITH_SKILLS)
      .eq('account_type', 'talent')
      .neq('id', id)
      .filter('talent_skills.category', 'eq', primaryCategory)
      .limit(6)

    similarTalent = (similar ?? []).map(p => ({
      profile: p as Profile & { talent_skills: TalentSkill[] },
      match_score: 0,
    }))
  }

  return {
    profile: profile as Profile & { talent_skills: TalentSkill[] },
    credits,
    portfolioItems,
    likesCount,
    viewsCount,
    similarTalent,
    talentDetails: displayDetails(attributes as Record<string, unknown> | null, sensitivePreferences),
  }
}
