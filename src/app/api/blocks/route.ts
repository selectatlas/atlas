import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

// GET /api/blocks — list profiles I have blocked
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json({ blocks: data ?? [] })
}

// POST /api/blocks — block a user (idempotent)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { blocked_id } = parsedBody.body
  if (!isUuid(blocked_id)) return badRequest('blocked_id must be a valid id')
  if (blocked_id === user.id) return badRequest('You cannot block yourself')

  const limited = await enforceRateLimit(`blocks:${user.id}`, 3600, 30)
  if (limited) return limited

  // Target must exist (as any profile - both roles can block)
  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', blocked_id)
    .maybeSingle()
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 })

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id })

  // 23505 = already blocked; treat as success (idempotent)
  if (error && error.code !== '23505') {
    logEvent('error', 'block_insert_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to block user' }, { status: 500 })
  }

  return Response.json({ blocked: true })
}

// DELETE /api/blocks — unblock a user
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { blocked_id } = parsedBody.body
  if (!isUuid(blocked_id)) return badRequest('blocked_id must be a valid id')

  await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blocked_id)

  return Response.json({ blocked: false })
}
