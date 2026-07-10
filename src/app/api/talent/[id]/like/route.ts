import { createClient } from '@/lib/supabase/server'

// POST /api/talent/[id]/like — toggle like for the current user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: talent_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
      console.error('Like insert error:', error)
      return Response.json({ error: 'Failed to like' }, { status: 500 })
    }
  }

  // Get updated count
  const { count } = await supabase
    .from('profile_likes')
    .select('id', { count: 'exact', head: true })
    .eq('talent_id', talent_id)

  return Response.json({
    liked: !existing,
    likes_count: count ?? 0,
  })
}
