import { createServiceClient } from '@/lib/supabase/server'
import { embedText, parseSearchQuery } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { filtersToDatabase, parseSearchFilterObject, type SearchFilters } from '@/lib/search-filters'

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
  // Verify the caller is authenticated before reading anything else
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const query = cleanString(parsedBody.body.query, 500)
  if (!query) return badRequest('query is required (max 500 characters)')
  const requestedFilters = parseSearchFilterObject(parsedBody.body.filters)
  if (!requestedFilters.ok) return badRequest(requestedFilters.error)

  // Talent search is a hirer feature - reject cross-role calls before spending
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single()
  if (callerProfile?.account_type !== 'hirer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit + daily AI quota BEFORE any OpenAI spend
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

  const { data: matches, error } = await serviceClient.rpc('match_talent_filtered', {
    query_embedding: queryEmbedding,
    filters: filtersToDatabase(effectiveFilters),
    match_count: 20,
  })

  if (error) {
    logEvent('error', 'search_pgvector_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }

  // Fetch full profiles + skills for the matched IDs
  const profileIds = (matches as Array<{ profile_id: string; similarity: number }>).map(m => m.profile_id)
  const similarityMap = new Map(
    (matches as Array<{ profile_id: string; similarity: number }>).map(m => [m.profile_id, m.similarity])
  )

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .in('id', profileIds)
    .eq('account_type', 'talent')
    .neq('profile_visibility', 'private')

  if (!profiles) return Response.json({ results: [] })

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
      }
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 12)

  return Response.json({ results, parsed, filters: effectiveFilters })
}
