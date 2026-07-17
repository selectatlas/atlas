import { getAuthenticatedCaller } from '@/lib/access'
import { parseJsonBody, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { MAX_SAVED_SEARCHES, mapSavedSearchRow, parseSavedSearchInput, type SavedSearchRow } from '@/lib/saved-searches'
import { fetchSavedSearches } from '@/lib/saved-searches-server'

// GET /api/saved-searches — list my saved searches (hirer only)
export async function GET() {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const savedSearches = await fetchSavedSearches(caller.supabase, caller.user.id)
  return Response.json({ savedSearches })
}

// POST /api/saved-searches — save the current query + filter set (hirer only)
export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = caller.supabase
  const user = caller.user

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const parsed = parseSavedSearchInput(parsedBody.body)
  if (!parsed.ok) return badRequest(parsed.error)

  const limited = await enforceRateLimit(`saved-searches:${user.id}`, 30, 60)
  if (limited) return limited

  const { count } = await supabase
    .from('saved_searches')
    .select('id', { count: 'exact', head: true })
    .eq('hirer_id', user.id)
  if ((count ?? 0) >= MAX_SAVED_SEARCHES) {
    return badRequest(`You can keep up to ${MAX_SAVED_SEARCHES} saved searches. Delete one first.`)
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      hirer_id: user.id,
      name: parsed.input.name,
      query: parsed.input.query,
      filters: parsed.input.filters,
    })
    .select('id, name, query, filters, last_viewed_at, created_at')
    .single()

  if (error || !data) {
    logEvent('error', 'saved_search_insert_error', { user_id: user.id, code: error?.code ?? null })
    return Response.json({ error: 'Failed to save search' }, { status: 500 })
  }

  return Response.json({ savedSearch: mapSavedSearchRow(data as SavedSearchRow) }, { status: 201 })
}
