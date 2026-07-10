import { createClient } from '@/lib/supabase/server'
import type { Profile, TalentSkill, Credit, PortfolioItem } from '@/types'

export async function getTalentProfile(id: string) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, talent_skills(*)')
    .eq('id', id)
    .eq('account_type', 'talent')
    .single()

  if (!profile) return null

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
      .select('*, talent_skills(*)')
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
    similarTalent
  }
}
