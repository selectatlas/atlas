import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/validation'
import { logEvent } from '@/lib/log'

// Ownership is checked through the service client so a wrong-owner request
// returns 403 rather than leaking existence semantics through RLS (which
// would make every foreign row look like a 404).
async function resolveOwnedSearch(id: string): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: Response }
> {
  if (!isUuid(id)) return { ok: false, response: Response.json({ error: 'Not found' }, { status: 404 }) }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const service = createServiceClient()
  const { data: row } = await service
    .from('saved_searches')
    .select('hirer_id')
    .eq('id', id)
    .maybeSingle()

  if (!row) return { ok: false, response: Response.json({ error: 'Not found' }, { status: 404 }) }
  if (row.hirer_id !== user.id) return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }

  return { ok: true, supabase, userId: user.id }
}

// PATCH /api/saved-searches/[id] — mark the search as just run, which
// clears its new-match alert (last_viewed_at moves to now).
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const owned = await resolveOwnedSearch(id)
  if (!owned.ok) return owned.response

  const { error } = await owned.supabase
    .from('saved_searches')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    logEvent('error', 'saved_search_touch_error', { user_id: owned.userId, code: error.code ?? null })
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }
  return Response.json({ ok: true })
}

// DELETE /api/saved-searches/[id] — remove a saved search
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const owned = await resolveOwnedSearch(id)
  if (!owned.ok) return owned.response

  const { error } = await owned.supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)

  if (error) {
    logEvent('error', 'saved_search_delete_error', { user_id: owned.userId, code: error.code ?? null })
    return Response.json({ error: 'Delete failed' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
