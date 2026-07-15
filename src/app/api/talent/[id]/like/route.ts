import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { getPostHogClient } from '@/lib/posthog-server'

// POST /api/talent/[id]/like — toggle like for the current user
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: talent_id } = await params
  if (!isUuid(talent_id)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceRateLimit(`likes:${user.id}`, 60, 60)
  if (limited) return limited

  // Like — target must be a talent profile (not hirers or self)
  const { data: talent } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', talent_id)
    .eq('account_type', 'talent')
    .maybeSingle()
  if (!talent) return Response.json({ error: 'Not found' }, { status: 404 })
  if (talent_id === user.id) return Response.json({ error: 'Not found' }, { status: 404 })

  // Check if already liked
  const { data: existing } = await supabase
    .from('profile_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('talent_id', talent_id)
    .maybeSingle()

  if (existing) {
    // Unlike
    await supabase.from('profile_likes').delete().eq('id', existing.id)
  } else {
    // Like
    const { error } = await supabase
      .from('profile_likes')
      .insert({ user_id: user.id, talent_id })
    if (error) {
      logEvent('error', 'like_insert_error', { user_id: user.id, code: error.code ?? null })
      return Response.json({ error: 'Failed to like' }, { status: 500 })
    }
  }

  // Get updated count
  const { count } = await supabase
    .from('profile_likes')
    .select('id', { count: 'exact', head: true })
    .eq('talent_id', talent_id)

  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: user.id,
    event: existing ? 'talent_unliked' : 'talent_liked',
    properties: {
      talent_id,
      likes_count: count ?? 0,
    },
  })
  void posthog.flush()

  return Response.json({
    liked: !existing,
    likes_count: count ?? 0,
  })
}
