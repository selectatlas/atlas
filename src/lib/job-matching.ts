import { createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/openai'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { filtersToDatabase } from '@/lib/search-filters'
import { rankingSimilarity, normalizeMatchScore } from '@/lib/matching'
import { CATEGORY_LABELS } from '@/lib/skills'
import { cardBadgesFromAttributes } from '@/lib/talent-card-badges'
import { buildCardImages } from '@/lib/talent-card-media'
import { cardPreviewImageCap } from '@/lib/membership'
import { logEvent } from '@/lib/log'
import type { Job, TalentSearchResult } from '@/types'

const CANDIDATE_COUNT = 20
const MAX_RESULTS = 8

type MatchableProfile = {
  city?: string | null
  country?: string | null
  availability?: string | null
  talent_skills: Array<{ category: string; skill: string }>
}

// Must stay byte-identical to the source text embedJob writes
// (src/lib/job-embedding.ts) - the fallback path re-embeds a job whose stored
// vector is missing, and a drifting formula would silently produce a vector
// from a different space than the one search was tuned against.
export function jobEmbeddingSourceText(job: Pick<Job, 'title' | 'description' | 'skills_required'>): string {
  return `${job.title} ${job.description} ${(job.skills_required ?? []).join(' ')}`
}

// PostgREST serialises a pgvector column as a JSON-array string ("[0.1,0.2]"),
// but returns a real array when the value round-trips through an RPC. Accept
// both and reject anything else rather than feeding junk to the matcher.
export function parseStoredEmbedding(value: unknown): number[] | null {
  const candidate = typeof value === 'string' ? safeParse(value) : value
  if (!Array.isArray(candidate) || candidate.length === 0) return null
  if (!candidate.every(entry => typeof entry === 'number' && Number.isFinite(entry))) return null
  return candidate as number[]
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalise(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Why this talent matches this job, from the hirer's side. Mirrors
// getJobMatchReasons in matching.ts, which answers the same question for talent.
export function getTalentMatchReasons(job: Job, profile: MatchableProfile): string[] {
  const reasons: string[] = []
  const skills = profile.talent_skills ?? []

  const matchedSkills = (job.skills_required ?? []).filter(required => {
    const requiredSkill = normalise(required)
    if (!requiredSkill) return false
    return skills.some(skill => {
      const talentSkill = normalise(skill.skill)
      return talentSkill.includes(requiredSkill) || requiredSkill.includes(talentSkill)
    })
  })
  if (matchedSkills.length > 0) reasons.push(`Skill: ${matchedSkills.slice(0, 2).join(', ')}`)

  if (skills.some(skill => skill.category === job.category)) {
    reasons.push(`${CATEGORY_LABELS[job.category]} talent`)
  }

  if (profile.city && normalise(job.location).includes(normalise(profile.city))) {
    reasons.push(`Based in ${profile.city}`)
  }

  const jobMonth = job.start_date
    ? new Date(`${job.start_date}T00:00:00`).toLocaleString('en-GB', { month: 'long' })
    : null
  if (jobMonth && normalise(profile.availability).includes(normalise(jobMonth))) {
    reasons.push(`Available in ${jobMonth}`)
  }

  return reasons.slice(0, 3)
}

export type JobMatchResult =
  | { ok: true; results: TalentSearchResult[] }
  | { ok: false; status: number; error: string }

// Ranked talent for a job brief. Reuses the vector written at post time, so
// the common case costs no OpenAI spend; only a job whose embedding never
// landed falls back to embedding on read.
export async function matchTalentForJob(job: Job, matchCount: number = CANDIDATE_COUNT): Promise<JobMatchResult> {
  const service = createServiceClient()

  const { data: embeddingRow } = await service
    .from('job_embeddings')
    .select('embedding')
    .eq('job_id', job.id)
    .maybeSingle()

  let jobEmbedding = parseStoredEmbedding(embeddingRow?.embedding)
  if (!jobEmbedding) {
    try {
      jobEmbedding = await embedText(jobEmbeddingSourceText(job))
    } catch (err) {
      logEvent('error', 'job_matching_embed_error', {
        job_id: job.id,
        message: err instanceof Error ? err.message : 'unknown',
      })
      return { ok: false, status: 503, error: 'Matching is temporarily unavailable' }
    }
  }

  // Category is the only structured filter. Job locations are free text
  // ("London, UK") while profiles carry city/country, so filtering on location
  // would empty the shortlist; it earns a match reason instead.
  const { data: matches, error } = await service.rpc('match_talent_filtered', {
    query_embedding: jobEmbedding,
    filters: filtersToDatabase({ category: job.category }),
    match_count: matchCount,
  })

  if (error) {
    logEvent('error', 'job_matching_pgvector_error', { job_id: job.id, code: error.code ?? null })
    return { ok: false, status: 500, error: 'Matching failed' }
  }

  const matchRows = (matches ?? []) as Array<{ profile_id: string; similarity: number }>
  if (matchRows.length === 0) return { ok: true, results: [] }

  const similarityMap = new Map(matchRows.map(row => [row.profile_id, row.similarity]))
  const { data: profiles } = await service
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .in('id', matchRows.map(row => row.profile_id))
    .eq('account_type', 'talent')
    .neq('profile_visibility', 'private')

  if (!profiles || profiles.length === 0) return { ok: true, results: [] }

  const ranked = (profiles as Array<Record<string, unknown> & MatchableProfile>)
    .map(profile => {
      const similarity = similarityMap.get(profile.id as string) ?? 0
      return { profile, similarity }
    })
    // Rank on raw similarity plus the verification boost, matching the DB
    // ordering; the display score clamps to 55-98 and would collapse ties.
    .sort(
      (a, b) =>
        rankingSimilarity(b.similarity, b.profile.verified_at as string | null) -
        rankingSimilarity(a.similarity, a.profile.verified_at as string | null),
    )
    .slice(0, MAX_RESULTS)

  const resultIds = ranked.map(entry => entry.profile.id as string)
  const [{ data: attributeRows }, { data: portfolioRows }] = await Promise.all([
    service.from('talent_profiles').select('profile_id, public_attributes').in('profile_id', resultIds),
    service
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

  const results = ranked.map(entry => ({
    profile: entry.profile,
    match_score: normalizeMatchScore(entry.similarity),
    match_reasons: getTalentMatchReasons(job, entry.profile),
    badges: badgeMap.get(entry.profile.id as string),
    // Preview count is tier-gated; enforced server-side.
    images: buildCardImages(
      entry.profile.avatar_url as string | null,
      portfolioByProfile.get(entry.profile.id as string) ?? [],
      cardPreviewImageCap((entry.profile as { membership_tier?: string }).membership_tier),
    ),
  })) as unknown as TalentSearchResult[]

  return { ok: true, results }
}
