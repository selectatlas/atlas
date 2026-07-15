import { createClient } from '@/lib/supabase/server'

// GET /api/likes — list talent IDs the current user has liked
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('profile_likes')
    .select('talent_id')
    .eq('user_id', user.id)

  const ids = (data ?? []).map(row => row.talent_id as string)
  return Response.json({ ids })
}
