import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/validation'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

// POST /api/talent/[id]/view — record a profile view
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: talent_id } = await params
  if (!isUuid(talent_id)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Views can be anonymous, so limit per IP (and per user when signed in)
  // to stop a single client flooding the table.
  const limitKey = user ? `views:${user.id}` : `views-ip:${getClientIp(request)}`
  const limited = await enforceRateLimit(limitKey, 60, 60)
  if (limited) return limited

  // Only real talent profiles accumulate views - arbitrary UUIDs (or hirer
  // ids) must not pollute the stats tables.
  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', talent_id)
    .eq('account_type', 'talent')
    .maybeSingle()
  if (!target) return Response.json({ error: 'Not found' }, { status: 404 })

  // Record the view (viewer_id is nullable for anonymous users); viewing
  // your own profile is not a view.
  if (user?.id !== talent_id) {
    const { error } = await supabase
      .from('profile_views')
      .insert({
        talent_id,
        viewer_id: user?.id ?? null,
      })

    if (error) {
      logEvent('error', 'view_insert_error', { talent_id, code: error.code ?? null })
      return Response.json({ error: 'Failed to record view' }, { status: 500 })
    }
  }

  // Get updated count
  const { count } = await supabase
    .from('profile_views')
    .select('id', { count: 'exact', head: true })
    .eq('talent_id', talent_id)

  return Response.json({ views_count: count ?? 0 })
}
