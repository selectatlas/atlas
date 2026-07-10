import { createClient } from '@/lib/supabase/server'

// GET /api/shortlist — list my shortlisted talent IDs
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('shortlists')
    .select('talent_id')
    .eq('hirer_id', user.id)

  const ids = (data ?? []).map(r => r.talent_id as string)
  return Response.json({ ids })
}

// POST /api/shortlist — toggle shortlist for a talent
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { talent_id } = await request.json() as { talent_id: string }
  if (!talent_id) return Response.json({ error: 'talent_id required' }, { status: 400 })

  // Check if already shortlisted
  const { data: existing } = await supabase
    .from('shortlists')
    .select('id')
    .eq('hirer_id', user.id)
    .eq('talent_id', talent_id)
    .maybeSingle()

  if (existing) {
    // Remove
    await supabase
      .from('shortlists')
      .delete()
      .eq('id', existing.id)
    return Response.json({ shortlisted: false })
  }

  // Add
  const { error } = await supabase
    .from('shortlists')
    .insert({ hirer_id: user.id, talent_id })

  if (error) {
    console.error('Shortlist insert error:', error)
    return Response.json({ error: 'Failed to shortlist' }, { status: 500 })
  }

  return Response.json({ shortlisted: true })
}
