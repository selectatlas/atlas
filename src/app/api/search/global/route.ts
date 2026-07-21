import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedCaller } from '@/lib/access'
import { parseSearchQuery } from '@/lib/openai'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import {
  EMPTY_GLOBAL_RESULTS,
  GLOBAL_GROUP_LIMIT,
  groupGlobalResults,
  matchDestinations,
  normaliseGlobalTerm,
  shouldFallbackToAi,
  type GlobalHit,
  type GlobalResults,
} from '@/lib/global-search'

// Global search: the box when the user is not on Talent or Jobs. It routes one
// query across the surfaces it could mean, rather than ranking within one.
//
// Plain matching runs first and in parallel - it is cheap, exact and needs no
// AI quota. The parser is only consulted when every surface came back empty,
// so an exact name match never waits on an LLM.

type TalentRow = { id: string; full_name: string; headline: string | null; city: string | null }
type JobRow = { id: string; title: string; location: string | null }
type MessageRow = { id: string; thread_id: string; content: string }

function toTalentHits(data: unknown): GlobalHit[] {
  return ((data ?? []) as TalentRow[]).map(row => ({
    id: row.id,
    category: 'talent' as const,
    title: row.full_name,
    subtitle: row.headline ?? row.city,
    href: `/talent/${row.id}`,
  }))
}

/** Talent by name, headline, location or skill - via the anon-safe view. */
async function matchTalent(supabase: SupabaseClient, term: string): Promise<GlobalHit[]> {
  const { data } = await supabase
    .from('public_talent_profiles')
    .select('id, full_name, headline, city')
    .ilike('search_text', `%${term}%`)
    .limit(GLOBAL_GROUP_LIMIT)

  return toTalentHits(data)
}

/**
 * Talent matching ANY of the parsed terms. The AI fallback yields several
 * independent concepts ("dancer", "bollywood", "choreography"); ANDing them
 * into one substring would demand that exact contiguous phrase and match
 * nothing, so each term is its own OR branch.
 */
async function matchTalentAny(supabase: SupabaseClient, terms: string[]): Promise<GlobalHit[]> {
  if (terms.length === 0) return []
  const { data } = await supabase
    .from('public_talent_profiles')
    .select('id, full_name, headline, city')
    .or(terms.map(term => `search_text.ilike."%${term}%"`).join(','))
    .limit(GLOBAL_GROUP_LIMIT)

  return toTalentHits(data)
}

/** Open jobs by title or location - via the view that already excludes
    closed and removed postings. */
async function matchJobs(supabase: SupabaseClient, term: string): Promise<GlobalHit[]> {
  const { data } = await supabase
    .from('public_open_jobs')
    .select('id, title, location')
    .or(`title.ilike."%${term}%",location.ilike."%${term}%"`)
    .limit(GLOBAL_GROUP_LIMIT)

  return ((data ?? []) as JobRow[]).map(row => ({
    id: row.id,
    category: 'jobs' as const,
    title: row.title,
    subtitle: row.location,
    href: `/jobs/${row.id}`,
  }))
}

/**
 * Message content, scoped to threads the caller actually participates in.
 * RLS also bounds this, but the explicit thread scope is the ownership check -
 * never trust the row filter alone to decide whose messages these are.
 */
async function matchMessages(
  supabase: SupabaseClient,
  term: string,
  userId: string,
): Promise<GlobalHit[]> {
  const { data: participantRows } = await supabase
    .from('thread_participants')
    .select('thread_id')
    .eq('profile_id', userId)

  const threadIds = (participantRows ?? []).map(row => row.thread_id as string)
  if (threadIds.length === 0) return []

  const { data } = await supabase
    .from('messages')
    .select('id, thread_id, content')
    .in('thread_id', threadIds)
    .ilike('content', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(GLOBAL_GROUP_LIMIT)

  return ((data ?? []) as MessageRow[]).map(row => ({
    id: row.id,
    category: 'messages' as const,
    title: row.content.slice(0, 80),
    subtitle: 'In your messages',
    href: `/messages/${row.thread_id}`,
  }))
}

export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response

  const { supabase, user } = caller

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const query = cleanString(parsedBody.body.query, 500)
  if (!query) return badRequest('query is required (max 500 characters)')

  const term = normaliseGlobalTerm(query)
  if (!term) return Response.json({ groups: [], usedAi: false })

  // Plain matching is cheap but still hits the database on every keystroke,
  // so it carries its own limit independent of the AI quota.
  const limited = await enforceRateLimit(`global-search:${user.id}`, 60, 40)
  if (limited) return limited

  const [talent, jobs, messages] = await Promise.all([
    matchTalent(supabase, term),
    matchJobs(supabase, term),
    matchMessages(supabase, term, user.id),
  ])

  const results: GlobalResults = {
    ...EMPTY_GLOBAL_RESULTS,
    talent,
    jobs,
    messages,
    settings: matchDestinations(term),
  }

  // Only when every surface came back empty is the parser worth its quota.
  let usedAi = false
  if (shouldFallbackToAi(results)) {
    const quota = await enforceAiQuota(user.id)
    if (quota) return quota

    try {
      const parsed = await parseSearchQuery(query)
      usedAi = true
      // Re-run the talent lookup against what the parser understood, which
      // catches queries whose literal characters matched nothing.
      const semanticTerms = [parsed.category, ...parsed.skills, parsed.location]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map(value => normaliseGlobalTerm(value))
        .filter((value): value is string => value !== null)
      results.talent = await matchTalentAny(supabase, semanticTerms)
    } catch (err) {
      logEvent('error', 'global_search_openai_error', {
        user_id: user.id,
        message: err instanceof Error ? err.message : 'unknown',
      })
      // A failed parse is not fatal: an empty result set is still a valid
      // answer, and the caller already has a keyword fallback of its own.
    }
  }

  return Response.json({ groups: groupGlobalResults(results), usedAi })
}
