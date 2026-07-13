import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// GET /api/messages/threads — list threads with latest message + other participant
export async function GET() {
  const localDemoMode = process.env.NODE_ENV === 'development' && (await cookies()).get('atlas_demo')?.value === '1'
  if (localDemoMode) return Response.json({ threads: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Get threads I'm a participant of
  const { data: myThreads } = await supabase
    .from('thread_participants')
    .select('thread_id')
    .eq('profile_id', user.id)

  const threadIds = (myThreads ?? []).map(t => t.thread_id as string)
  if (threadIds.length === 0) return Response.json({ threads: [] })

  // Get all participants + latest message for each thread
  const { data: threads } = await supabase
    .from('message_threads')
    .select(`
      id,
      created_at,
      thread_participants(profile_id, profiles(full_name, avatar_url)),
      messages!inner(id, content, sender_id, created_at)
    `)
    .in('id', threadIds)
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { foreignTable: 'messages' })

  // Flatten and sort by latest message time
  const result = (threads ?? []).map(thread => {
    const msg = (thread.messages as Array<{ id: string; content: string; sender_id: string; created_at: string }>)[0]
    const participants = (thread.thread_participants as unknown as Array<{
      profile_id: string
      profiles: { full_name: string; avatar_url: string | null } | null
    }>)
    const other = participants.find(p => p.profile_id !== user.id)
    return {
      id: thread.id,
      otherName: other?.profiles?.full_name ?? 'Unknown',
      otherAvatar: other?.profiles?.avatar_url ?? null,
      lastMessage: msg?.content ?? '',
      lastSenderId: msg?.sender_id ?? '',
      lastMessageAt: msg?.created_at ?? thread.created_at,
    }
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  return Response.json({ threads: result })
}

// POST /api/messages/threads — find or create a thread between two users
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { talent_id } = await request.json() as { talent_id: string }
  if (!talent_id) return Response.json({ error: 'talent_id required' }, { status: 400 })

  // The database function validates roles and creates both participants atomically.
  const { data: threadId, error } = await supabase.rpc('create_or_get_thread', {
    other_profile_id: talent_id,
  })

  if (error || !threadId) {
    const status = error?.code === '42501' ? 403 : error?.code === '22023' ? 400 : 500
    return Response.json(
      { error: status === 403 ? 'Forbidden' : status === 400 ? 'Invalid participant' : 'Failed to create thread' },
      { status },
    )
  }

  return Response.json({ thread_id: threadId }, { status: 201 })
}
