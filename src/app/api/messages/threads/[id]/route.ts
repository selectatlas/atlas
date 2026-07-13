import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/messages/threads/[id] — list messages for a thread
export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: threadId } = await params

  // Verify user is a participant
  const { data: participant } = await supabase
    .from('thread_participants')
    .select('profile_id')
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!participant) return Response.json({ error: 'Not a participant' }, { status: 403 })

  // Get the other participant info
  const { data: other } = await supabase
    .from('thread_participants')
    .select('profiles(full_name, avatar_url)')
    .eq('thread_id', threadId)
    .neq('profile_id', user.id)
    .single()

  // Get messages (newest last, limited)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, content, sender_id, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(100)

  // Mark as read
  await supabase
    .from('thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)

  return Response.json({
    thread_id: threadId,
    other: other?.profiles ?? null,
    messages: messages ?? [],
  })
}

// POST /api/messages/threads/[id] — send a message
export async function POST(request: Request, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: threadId } = await params
  const { content } = await request.json() as { content: string }

  if (!content?.trim()) return Response.json({ error: 'content required' }, { status: 400 })
  if (content.trim().length > 5000) {
    return Response.json({ error: 'content must be 5000 characters or fewer' }, { status: 400 })
  }

  // Verify participant
  const { data: participant } = await supabase
    .from('thread_participants')
    .select('profile_id')
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!participant) return Response.json({ error: 'Not a participant' }, { status: 403 })

  const { data: message, error } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, sender_id: user.id, content: content.trim() })
    .select('id, content, sender_id, created_at')
    .single()

  if (error || !message) {
    return Response.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return Response.json({ message }, { status: 201 })
}
