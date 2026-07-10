import { createClient } from '@/lib/supabase/server'

// POST /api/talent/[id]/view — record a profile view
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: talent_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Record the view (viewer_id is nullable for anonymous users)
  const { error } = await supabase
    .from('profile_views')
    .insert({
      talent_id,
      viewer_id: user?.id ?? null,
    })

  if (error) {
    console.error('View insert error:', error)
    return Response.json({ error: 'Failed to record view' }, { status: 500 })
  }

  // Get updated count
  const { count } = await supabase
    .from('profile_views')
    .select('id', { count: 'exact', head: true })
    .eq('talent_id', talent_id)

  return Response.json({ views_count: count ?? 0 })
}
