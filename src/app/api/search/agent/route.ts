import { getAuthenticatedCaller } from '@/lib/access'
import { runAgentSearch } from '@/lib/agent-search'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { parseSearchFilterObject } from '@/lib/search-filters'
import { logEvent } from '@/lib/log'

// One agent run makes several OpenAI calls, so it gets its own (stricter)
// limits on top of the shared daily AI quota. The daily cap fails closed
// like the AI quota does - never spend unmetered credit.
const RUNS_PER_MINUTE = 3
const RUNS_PER_DAY = 25

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

  // All limits BEFORE any OpenAI spend
  const limited =
    (await enforceRateLimit(`agent-search:${user.id}`, 60, RUNS_PER_MINUTE)) ??
    (await enforceRateLimit(`agent-search-daily:${user.id}`, 86_400, RUNS_PER_DAY, { failClosed: true })) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  // Stream newline-delimited JSON: status events while the agent works,
  // then a single results (or error) event.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      const startedAt = Date.now()
      try {
        const output = await runAgentSearch({
          query,
          filters: requestedFilters.filters,
          onEvent: send,
        })
        send({ type: 'results', summary: output.summary, results: output.results })
        logEvent('info', 'agent_search_completed', {
          user_id: user.id,
          searches: output.searches,
          result_count: output.results.length,
          duration_ms: Date.now() - startedAt,
        })
      } catch (err) {
        logEvent('error', 'agent_search_error', {
          user_id: user.id,
          message: err instanceof Error ? err.message : 'unknown',
        })
        send({ type: 'error', error: 'Deep search is temporarily unavailable' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
