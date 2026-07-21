import { getAuthenticatedCaller } from '@/lib/access'
import { parseJobQuery } from '@/lib/openai'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { fetchDiscoverJobs, DISCOVER_PAGE_SIZE, sanitizeSearchTerm } from '@/lib/job-discovery'
import { isEmptyJobIntent, jobIntentChips, jobIntentToFilters } from '@/lib/job-intent'

// Natural-language job search: the jobs-side mirror of /api/search. The query
// is parsed by gpt-4o-mini into the structured fields the discover feed
// already filters on, then answered by the same query path - so ranking,
// RLS and pagination behave identically to browsing the feed by hand.
//
// Talent-only. A hirer searching for work is not a supported flow, and the
// route spends AI quota, so the role check runs before any OpenAI call.
export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canTalent) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const user = caller.user

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const query = cleanString(parsedBody.body.query, 500)
  if (!query) return badRequest('query is required (max 500 characters)')

  const limited =
    (await enforceRateLimit(`jobs-search:${user.id}`, 60, 20)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  let parsed: Awaited<ReturnType<typeof parseJobQuery>>
  try {
    parsed = await parseJobQuery(query)
  } catch (err) {
    logEvent('error', 'jobs_search_openai_error', {
      user_id: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return Response.json({ error: 'Search is temporarily unavailable' }, { status: 503 })
  }

  // A parse that yielded nothing structured still deserves an answer: fall
  // back to treating the raw query as a plain full-text term.
  const emptyIntent = isEmptyJobIntent(parsed)
  const filters = emptyIntent
    ? {
        categories: [],
        search: sanitizeSearchTerm(query),
        workType: 'all' as const,
        location: null,
        budgetBand: 'any' as const,
        sort: 'relevance' as const,
      }
    : jobIntentToFilters(parsed)

  const result = await fetchDiscoverJobs(caller.supabase, filters, { cursor: null })
  if (!result.ok) {
    logEvent('error', 'jobs_search_query_failed', { user_id: user.id })
    return Response.json({ error: 'Jobs could not be loaded' }, { status: 500 })
  }

  return Response.json({
    jobs: result.page.jobs.slice(0, DISCOVER_PAGE_SIZE),
    total: result.page.total,
    parsed,
    chips: jobIntentChips(parsed),
    /** True when the structured parse was empty and we ran plain keyword search. */
    fellBackToKeyword: emptyIntent,
  })
}
