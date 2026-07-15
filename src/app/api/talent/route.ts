import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { filtersToDatabase, parseSearchFilterParams } from '@/lib/search-filters'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import type { Profile, TalentSkill } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLocalDemo = process.env.NODE_ENV === 'development' &&
    /(?:^|;\s*)atlas_demo=1(?:;|$)/.test(request.headers.get('cookie') ?? '')
  if (!user && !isLocalDemo) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isLocalDemo) {
    const { data: caller } = await supabase.from('profiles').select('account_type').eq('id', user!.id).single()
    if (caller?.account_type !== 'hirer') return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limited = await enforceRateLimit(`talent-browse:${user?.id ?? 'local-demo'}`, 60, 60)
  if (limited) return limited

  const url = new URL(request.url)
  const parsed = parseSearchFilterParams(url.searchParams)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const page = Math.max(1, Math.min(1000, Math.trunc(Number(url.searchParams.get('page')) || 1)))
  const limit = Math.max(1, Math.min(100, Math.trunc(Number(url.searchParams.get('limit')) || 24)))
  const sort = url.searchParams.get('sort') === 'available' ? 'available' : 'newest'
  const service = createServiceClient()
  const { data: matches, error } = await service.rpc('search_talent_filtered', {
    filters: filtersToDatabase(parsed.filters),
    result_limit: limit,
    result_offset: (page - 1) * limit,
    result_sort: sort,
  })

  if (error) {
    logEvent('error', 'talent_browse_error', { user_id: user?.id ?? null, code: error.code ?? null })
    return Response.json({ error: 'Unable to load talent' }, { status: 500 })
  }

  const rows = (matches ?? []) as Array<{ profile_id: string; total_count: number }>
  const profileIds = rows.map(row => row.profile_id).filter(Boolean)
  if (profileIds.length === 0) return Response.json({ results: [], total: 0, page, limit })

  const { data: profiles, error: profilesError } = await service
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .in('id', profileIds)
    .eq('account_type', 'talent')
    .neq('profile_visibility', 'private')
  if (profilesError) return Response.json({ error: 'Unable to load talent' }, { status: 500 })

  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]))
  const results = profileIds.flatMap(id => {
    const profile = profileMap.get(id)
    return profile ? [{ profile: profile as Profile & { talent_skills: TalentSkill[] }, match_score: 0 }] : []
  })

  return Response.json({
    results,
    total: Number(rows[0]?.total_count ?? 0),
    page,
    limit,
  })
}
