import { createClient } from '@/lib/supabase/server'
import { isServerDemoOnly } from '@/lib/auth'
import { isThreadUnread } from '@/lib/inbox'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

// GET /api/messages/threads?filter=open|archived — list threads with latest message + other participant
export async function GET(request: Request) {
  if (await isServerDemoOnly()) return Response.json({ threads: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const filterParam = new URL(request.url).searchParams.get('filter')
  const filter = filterParam === 'archived' ? 'archived' : 'open'

  // Get threads I'm a participant of
  const { data: myThreads } = await supabase
    .from('thread_participants')
    .select('thread_id, last_read_at, archived_at')
    .eq('profile_id', user.id)

  const rows = (myThreads ?? []).filter(row =>
    filter === 'archived' ? row.archived_at !== null : row.archived_at === null,
  )
  const threadIds = rows.map(t => t.thread_id as string)
  if (threadIds.length === 0) return Response.json({ threads: [] })

  const readByThread = new Map(
    rows.map(row => [row.thread_id as string, row.last_read_at as string]),
  )

  // Get all participants + latest message for each thread
  const { data: threads } = await supabase
    .from('message_threads')
    .select(`
      id,
      created_at,
      origin_job_id,
      jobs(title),
      thread_participants(profile_id, profiles(full_name, avatar_url)),
      messages(id, content, sender_id, created_at)
    `)
    .in('id', threadIds)
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { foreignTable: 'messages' })

  // Flatten and sort by latest message time
  const result = (threads ?? []).map(thread => {
    const msgs = thread.messages as Array<{ id: string; content: string; sender_id: string; created_at: string }>
    const msg = msgs?.[0]
    const participants = (thread.thread_participants as unknown as Array<{
      profile_id: string
      profiles: { full_name: string; avatar_url: string | null } | null
    }>)
    const other = participants.find(p => p.profile_id !== user.id)
    const job = thread.jobs as unknown as { title: string } | null
    const lastReadAt = readByThread.get(thread.id as string) ?? new Date(0).toISOString()
    return {
      id: thread.id,
      otherId: other?.profile_id ?? null,
      otherName: other?.profiles?.full_name ?? 'Unknown',
      otherAvatar: other?.profiles?.avatar_url ?? null,
      lastMessage: msg?.content ?? 'No messages yet',
      lastSenderId: msg?.sender_id ?? '',
      lastMessageAt: msg?.created_at ?? thread.created_at,
      unread: isThreadUnread(msg, lastReadAt, user.id),
      archived: filter === 'archived',
      originJobId: (thread.origin_job_id as string | null) ?? null,
      originJobTitle: job?.title ?? null,
    }
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  return Response.json({ threads: result })
}

// POST /api/messages/threads — find or create a thread between two users
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { talent_id } = parsedBody.body
  if (!isUuid(talent_id)) return badRequest('talent_id must be a valid id')

  const limited = await enforceRateLimit(`threads-create:${user.id}`, 3600, 20)
  if (limited) return limited

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
