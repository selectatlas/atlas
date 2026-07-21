import { createServiceClient } from '@/lib/supabase/server'
import { embedText, parseSearchQuery } from '@/lib/openai'
import { getAuthenticatedCaller } from '@/lib/access'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { filtersToDatabase, parseSearchFilterObject, type SearchFilters } from '@/lib/search-filters'
import { rankingSimilarity } from '@/lib/matching'
import { cardBadgesFromAttributes } from '@/lib/talent-card-badges'
import { buildCardImages } from '@/lib/talent-card-media'
import { cardPreviewImageCap } from '@/lib/membership'
import { weekCutoffIso } from '@/lib/roster-freshness'

function normalise(value: string | null | undefined) {
  return (value ?? '').toLowerCase().trim()
}

function getMatchReasons(
  parsed: Awaited<ReturnType<typeof parseSearchQuery>>,
  profile: { city?: string | null; country?: string | null; availability?: string | null; talent_skills: Array<{ category: string; skill: string }> },
) {
  const reasons: string[] = []
  const skills = profile.talent_skills ?? []

  if (parsed.category && skills.some(skill => skill.category === parsed.category)) {
    reasons.push(`${parsed.category.replace('_', ' ')} talent`)
  }

  const matchedSkills = parsed.skills.filter(querySkill =>
    skills.some(skill => normalise(skill.skill).includes(normalise(querySkill)) || normalise(querySkill).includes(normalise(skill.skill)))
  )
  if (matchedSkills.length > 0) reasons.push(`Skill: ${matchedSkills.slice(0, 2).join(', ')}`)

  if (parsed.location) {
    const location = normalise(parsed.location)
    const profileLocation = normalise(`${profile.city ?? ''} ${profile.country ?? ''}`)
    if (profileLocation.includes(location)) reasons.push(`Based in ${profile.city ?? profile.country}`)
  }

  if (parsed.availability && normalise(profile.availability).includes(normalise(parsed.availability))) {
    reasons.push(profile.availability ?? 'Availability listed')
  }

  return reasons.length > 0 ? reasons.slice(0, 3) : []
}

export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const user = caller.user

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const query = cleanString(parsedBody.body.query, 500)
  if (!query) return badRequest('query is required (max 500 characters)')
  const requestedFilters = parseSearchFilterObject(parsedBody.body.filters)
  if (!requestedFilters.ok) return badRequest(requestedFilters.error)

  // Talent search is a hirer feature - reject cross-role calls before spending
  const limited =
    (await enforceRateLimit(`search:${user.id}`, 60, 20)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  // Run LLM parse and embedding IN PARALLEL to stay under the 2s SLA
  let parsed: Awaited<ReturnType<typeof parseSearchQuery>>
  let queryEmbedding: number[]
  try {
    ;[parsed, queryEmbedding] = await Promise.all([
      parseSearchQuery(query),
      embedText(query),
    ])
  } catch (err) {
    logEvent('error', 'search_openai_error', {
      user_id: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return Response.json({ error: 'Search is temporarily unavailable' }, { status: 503 })
  }

  // Build the pgvector similarity query via Supabase RPC
  // The function `match_talent` is defined below - call it via rpc
  const serviceClient = createServiceClient()

  // Explicit UI filters win over intent parsed from the natural-language query.
  // Both are pushed into SQL before the vector LIMIT so relevant filtered
  // profiles cannot disappear outside a global top-N candidate set.
  const combinedFilters: SearchFilters = { ...requestedFilters.filters }
  if (parsed.category && !combinedFilters.category) combinedFilters.category = parsed.category
  if (parsed.location && !combinedFilters.location) combinedFilters.location = parsed.location
  if (parsed.languages.length > 0 && !combinedFilters.languages) combinedFilters.languages = parsed.languages.map(language => language.toLowerCase().replace(/[^a-z0-9]+/g, '_'))
  if (parsed.gender.length > 0 && !combinedFilters.gender) combinedFilters.gender = parsed.gender
  if ((parsed.age_min !== null || parsed.age_max !== null) && !combinedFilters.age) combinedFilters.age = { min: parsed.age_min ?? undefined, max: parsed.age_max ?? undefined }
  if (parsed.spact !== null && combinedFilters.spact === undefined) combinedFilters.spact = parsed.spact
  const validatedCombined = parseSearchFilterObject(combinedFilters)
  const effectiveFilters = validatedCombined.ok ? validatedCombined.filters : requestedFilters.filters

  // Roster freshness runs alongside the vector search so it adds no latency.
  const visibleTalent = () =>
    serviceClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'talent')
      .neq('profile_visibility', 'private')

  const [{ data: matches, error }, totalResult, addedResult] = await Promise.all([
    serviceClient.rpc('match_talent_filtered', {
      query_embedding: queryEmbedding,
      filters: filtersToDatabase(effectiveFilters),
      match_count: 20,
    }),
    visibleTalent(),
    visibleTalent().gte('created_at', weekCutoffIso()),
  ])
  const roster = {
    total: totalResult.count ?? null,
    added_this_week: addedResult.count ?? null,
  }

  if (error) {
    logEvent('error', 'search_pgvector_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }

  // Fetch full profiles + skills for the matched IDs
  const matchRows = (matches ?? []) as Array<{ profile_id: string; similarity: number }>
  const profileIds = matchRows.map(m => m.profile_id)
  const similarityMap = new Map(matchRows.map(m => [m.profile_id, m.similarity]))

  if (profileIds.length === 0) return Response.json({ results: [], parsed, filters: effectiveFilters, roster })

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .in('id', profileIds)
    .eq('account_type', 'talent')
    .neq('profile_visibility', 'private')

  if (!profiles) return Response.json({ results: [], roster })

  const filtered = profiles as Array<Record<string, unknown> & { talent_skills: Array<{ category: string; skill: string }> }>

  // Sort by similarity and attach match score
  // Cosine similarity for text-embedding-3-small is typically 0.3-0.85 for relevant matches.
  // Scale to 55-98% so scores feel meaningful without being misleadingly high.
  const results = filtered
    .map(p => {
      const sim = similarityMap.get(p.id as string) ?? 0
      const score = Math.min(98, Math.max(55, Math.round(sim * 120)))
      return {
        profile: p,
        match_score: score,
        match_reasons: getMatchReasons(parsed, p),
        similarity: sim,
      }
    })
    // Rank on raw similarity plus the verification boost (same constant the
    // DB ordering uses): the display score clamps to 55-98, so sorting on it
    // would collapse everything at either bound into DB fetch order.
    .sort(
      (a, b) =>
        rankingSimilarity(b.similarity, b.profile.verified_at as string | null) -
        rankingSimilarity(a.similarity, a.profile.verified_at as string | null),
    )
    .slice(0, 12)

  // Card-level extras (badges + carousel images) for the final page only (max 12 ids).
  const resultIds = results.map(result => result.profile.id as string)
  const [{ data: attributeRows }, { data: portfolioRows }] = await Promise.all([
    serviceClient
      .from('talent_profiles')
      .select('profile_id, public_attributes')
      .in('profile_id', resultIds),
    serviceClient
      .from('portfolio_items')
      .select('profile_id, url, thumbnail_url')
      .eq('type', 'image')
      .in('profile_id', resultIds)
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

  const payload = results.map(result => ({
    profile: result.profile,
    match_score: result.match_score,
    match_reasons: result.match_reasons,
    badges: badgeMap.get(result.profile.id as string),
    // Preview count is tier-gated; enforced server-side.
    images: buildCardImages(
      result.profile.avatar_url as string | null,
      portfolioByProfile.get(result.profile.id as string) ?? [],
      cardPreviewImageCap((result.profile as { membership_tier?: string }).membership_tier),
    ),
  }))

  return Response.json({ results: payload, parsed, filters: effectiveFilters, roster })
}
