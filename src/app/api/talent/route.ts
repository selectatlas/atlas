import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlatformAdminRole } from '@/lib/platform-admin'
import { canActAsHirer } from '@/lib/access-core'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { filtersToDatabase, parseSearchFilterParams } from '@/lib/search-filters'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { cardBadgesFromAttributes } from '@/lib/talent-card-badges'
import { buildCardImages } from '@/lib/talent-card-media'
import { cardPreviewImageCap } from '@/lib/membership'
import type { Profile, TalentSkill } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const hasDemoCookie = process.env.NODE_ENV === 'development' &&
    /(?:^|;\s*)atlas_demo=1(?:;|$)/.test(request.headers.get('cookie') ?? '')
  const isLocalDemo = hasDemoCookie && !user
  if (!user && !isLocalDemo) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isLocalDemo) {
    const [{ data: caller }, adminRole] = await Promise.all([
      supabase.from('profiles').select('account_type').eq('id', user!.id).single(),
      getPlatformAdminRole(user!.id),
    ])
    if (!canActAsHirer(caller?.account_type, adminRole !== null)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
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

  // Card-level extras: capability badges (SPAC / stunt register) and
  // carousel images. Only the two booleans and image URLs leave the
  // server - the attribute record itself stays private.
  const [{ data: attributeRows }, { data: portfolioRows }] = await Promise.all([
    service
      .from('talent_profiles')
      .select('profile_id, public_attributes')
      .in('profile_id', profileIds),
    service
      .from('portfolio_items')
      .select('profile_id, url, thumbnail_url')
      .eq('type', 'image')
      .in('profile_id', profileIds)
      .order('sort_order', { ascending: true }),
  ])
  const badgeMap = new Map((attributeRows ?? []).map(row => [
    row.profile_id as string,
    cardBadgesFromAttributes(row.public_attributes as Record<string, unknown>),
  ]))
  const portfolioByProfile = new Map<string, string[]>()
  for (const row of portfolioRows ?? []) {
    const urls = portfolioByProfile.get(row.profile_id as string) ?? []
    urls.push((row.thumbnail_url ?? row.url) as string)
    portfolioByProfile.set(row.profile_id as string, urls)
  }

  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]))
  const results = profileIds.flatMap(id => {
    const profile = profileMap.get(id)
    if (!profile) return []
    return [{
      profile: profile as Profile & { talent_skills: TalentSkill[] },
      match_score: 0,
      badges: badgeMap.get(id),
      // Preview count is tier-gated (free 3, gold/platinum more) - enforced
      // here server-side so the client can never show more than allowed.
      images: buildCardImages(
        profile.avatar_url as string | null,
        portfolioByProfile.get(id) ?? [],
        cardPreviewImageCap((profile as { membership_tier?: string }).membership_tier),
      ),
    }]
  })

  return Response.json({
    results,
    total: Number(rows[0]?.total_count ?? 0),
    page,
    limit,
  })
}
