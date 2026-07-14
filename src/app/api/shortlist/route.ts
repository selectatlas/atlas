import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

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

// POST /api/shortlist — toggle shortlist for a talent (hirer only)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { talent_id } = parsedBody.body
  if (!isUuid(talent_id)) return badRequest('talent_id must be a valid id')

  // Shortlisting is a hirer feature
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single()
  if (profile?.account_type !== 'hirer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limited = await enforceRateLimit(`shortlist:${user.id}`, 60, 60)
  if (limited) return limited

  // The target must be a talent profile
  const { data: talent } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', talent_id)
    .eq('account_type', 'talent')
    .maybeSingle()
  if (!talent) return Response.json({ error: 'Talent not found' }, { status: 404 })

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
    logEvent('error', 'shortlist_insert_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to shortlist' }, { status: 500 })
  }

  return Response.json({ shortlisted: true })
}
