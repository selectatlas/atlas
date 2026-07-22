import type { createServiceClient } from '@/lib/supabase/server'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { filtersToDatabase, type SearchFilters } from '@/lib/search-filters'
import { cardBadgesFromAttributes } from '@/lib/talent-card-badges'
import { buildCardImages } from '@/lib/talent-card-media'
import { cardPreviewImageCap } from '@/lib/membership'
import type { Profile, TalentSkill, TalentSearchResult } from '@/types'

// Shared with the search page so the server-rendered first page and the
// client's "load more" pagination request the same page size.
export const BROWSE_PAGE_SIZE = 48

export interface TalentBrowseParams {
  filters: SearchFilters
  limit: number
  offset: number
  sort: 'newest' | 'available'
}

export interface TalentBrowseResult {
  results: TalentSearchResult[]
  total: number
}

// Shared by the /api/talent route (client pagination/filtering) and the
// search page's server-rendered first page - one query path, one place to
// keep the RPC + card-extras join in sync.
export async function fetchTalentBrowse(
  service: ReturnType<typeof createServiceClient>,
  { filters, limit, offset, sort }: TalentBrowseParams,
): Promise<TalentBrowseResult | { error: true }> {
  const { data: matches, error } = await service.rpc('search_talent_filtered', {
    filters: filtersToDatabase(filters),
    result_limit: limit,
    result_offset: offset,
    result_sort: sort,
  })
  if (error) return { error: true }

  const rows = (matches ?? []) as Array<{ profile_id: string; total_count: number }>
  const profileIds = rows.map(row => row.profile_id).filter(Boolean)
  if (profileIds.length === 0) return { results: [], total: 0 }

  const { data: profiles, error: profilesError } = await service
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .in('id', profileIds)
    .eq('account_type', 'talent')
    .neq('profile_visibility', 'private')
  if (profilesError) return { error: true }

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
  const results: TalentSearchResult[] = profileIds.flatMap(id => {
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

  return { results, total: Number(rows[0]?.total_count ?? 0) }
}
