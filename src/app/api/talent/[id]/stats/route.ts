import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/validation'

// GET /api/talent/[id]/stats — returns views, likes, and current user's like status
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Parallel: counts + user's like status
  const [likesResult, viewsResult, userLikeResult] = await Promise.all([
    supabase.from('profile_likes').select('id', { count: 'exact', head: true }).eq('talent_id', id),
    supabase.from('profile_views').select('id', { count: 'exact', head: true }).eq('talent_id', id),
    user
      ? supabase.from('profile_likes').select('id').eq('user_id', user.id).eq('talent_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return Response.json({
    views: viewsResult.count ?? 0,
    likes: likesResult.count ?? 0,
    liked: user ? (userLikeResult.data !== null) : false,
  })
}
