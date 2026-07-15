import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getPlatformAdminRole } from '@/lib/platform-admin'
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
  const hasDemoCookie = process.env.NODE_ENV === 'development' && cookieStore.get('atlas_demo')?.value === '1'
  const authClient = await createClient()
  const { data: claimsData } = await authClient.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null
  const isLocalDemo = hasDemoCookie && !userId

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

  const service = createServiceClient()
  const supabase = isLocalDemo ? service : authClient

  let callerAccountType: string | null = null

  if (isLocalDemo) {
    callerAccountType = cookieStore.get('atlas_demo_role')?.value ?? 'talent'
  } else if (userId) {
    const { data: callerProfile } = await service
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle()
    callerAccountType = callerProfile?.account_type ?? null
  }

  const [{ data: profile }, { data: attributes }] = await Promise.all([
    supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_WITH_SKILLS)
      .eq('id', id)
      .eq('account_type', 'talent')
      .single(),
    service.from('talent_profiles').select('*').eq('profile_id', id).maybeSingle(),
  ])

  if (!profile) return null

  const visibility = (profile as { profile_visibility?: string }).profile_visibility ?? 'public'
  const isOwner = Boolean(userId && userId === id)
  if (!isOwner && visibility !== 'public') {
    // Platform admins can review any profile regardless of visibility.
    const isPlatformAdmin = userId ? (await getPlatformAdminRole(userId)) !== null : false
    if (!isPlatformAdmin) {
      if (visibility === 'private') return null
      if (visibility === 'members' && callerAccountType !== 'hirer') return null
    }
  }

  const skills = profile.talent_skills as TalentSkill[]
  const primaryCategory = skills[0]?.category ?? null

  const [sensitiveResult, creditsResult, portfolioResult, statsResult, similarResult] = await Promise.all([
    callerAccountType === 'hirer'
      ? service.from('talent_sensitive_preferences').select('preferences').eq('profile_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('credits')
      .select('*')
      .eq('profile_id', id)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: false }),
    supabase
      .from('portfolio_items')
      .select('*')
      .eq('profile_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('talent_stats')
      .select('*')
      .eq('profile_id', id)
      .maybeSingle(),
    primaryCategory
      ? supabase
          .from('profiles')
          .select(PUBLIC_PROFILE_WITH_SKILLS)
          .eq('account_type', 'talent')
          .neq('id', id)
          .neq('profile_visibility', 'private')
          .filter('talent_skills.category', 'eq', primaryCategory)
          .limit(6)
      : Promise.resolve({ data: null }),
  ])

  const sensitivePreferences = sensitiveResult.data?.preferences as Record<string, boolean | null> | undefined
  const credits = (creditsResult.data ?? []) as Credit[]
  const portfolioItems = (portfolioResult.data ?? []) as PortfolioItem[]

  const stats = statsResult.data as Record<string, number> | null
  const likesCount = stats?.likes_count ?? 0
  const viewsCount = stats?.views_count ?? 0

  const similarTalent = ((similarResult.data ?? []) as Array<Record<string, unknown>>)
    .filter(p => (p as { profile_visibility?: string }).profile_visibility !== 'private')
    .map(p => ({
      profile: p as unknown as Profile & { talent_skills: TalentSkill[] },
      match_score: 0,
    }))

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
