import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/messages/threads/[id] — list messages for a thread
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: threadId } = await params
  if (!isUuid(threadId)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user is a participant
  const { data: participant } = await supabase
    .from('thread_participants')
    .select('profile_id, archived_at')
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!participant) return Response.json({ error: 'Not a participant' }, { status: 403 })

  // Get the other participant info (profile + read state for receipts)
  const { data: other } = await supabase
    .from('thread_participants')
    .select('profile_id, last_read_at, profiles(full_name, avatar_url)')
    .eq('thread_id', threadId)
    .neq('profile_id', user.id)
    .maybeSingle()

  // Thread origin context (outreach / job that started the conversation)
  const { data: thread } = await supabase
    .from('message_threads')
    .select('created_at, origin_outreach_id, origin_job_id, jobs(title), outreach(created_at, status)')
    .eq('id', threadId)
    .maybeSingle()

  // Linked application status for the pre-hire timeline: the application on
  // the origin job by whichever participant is the talent. RLS already scopes
  // visibility to the applicant and the job's hirer.
  let applicationStatus: string | null = null
  if (thread?.origin_job_id) {
    const participantIds = [user.id, other?.profile_id].filter((id): id is string => Boolean(id))
    const { data: application } = await supabase
      .from('applications')
      .select('status')
      .eq('job_id', thread.origin_job_id)
      .in('talent_id', participantIds)
      .maybeSingle()
    applicationStatus = (application?.status as string | null) ?? null
  }

  // Get messages (newest last, limited)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, content, kind, sender_id, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(100)

  // Mark as read
  const readAt = new Date().toISOString()
  await supabase
    .from('thread_participants')
    .update({ last_read_at: readAt })
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)

  const otherProfile = (other?.profiles ?? null) as { full_name: string; avatar_url: string | null } | null
  const originJob = (thread?.jobs ?? null) as unknown as { title: string } | null
  const originOutreach = (thread?.outreach ?? null) as unknown as { created_at: string; status: string | null } | null

  return Response.json({
    thread_id: threadId,
    created_at: thread?.created_at ?? null,
    archived: participant.archived_at !== null,
    read_at: readAt,
    other: otherProfile
      ? {
          profile_id: other?.profile_id ?? null,
          full_name: otherProfile.full_name,
          avatar_url: otherProfile.avatar_url,
          last_read_at: other?.last_read_at ?? null,
        }
      : null,
    origin: {
      outreach_id: thread?.origin_outreach_id ?? null,
      outreach_sent_at: originOutreach?.created_at ?? null,
      outreach_status: originOutreach?.status ?? null,
      job_id: thread?.origin_job_id ?? null,
      job_title: originJob?.title ?? null,
      application_status: applicationStatus,
    },
    messages: messages ?? [],
  })
}

// POST /api/messages/threads/[id] — send a message
export async function POST(request: Request, { params }: RouteParams) {
  const { id: threadId } = await params
  if (!isUuid(threadId)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const content = cleanString(parsedBody.body.content, 5000)
  if (!content) return badRequest('content is required (max 5000 characters)')

  const limited = await enforceRateLimit(`messages-send:${user.id}`, 60, 30)
  if (limited) return limited

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
    .insert({ thread_id: threadId, sender_id: user.id, content })
    .select('id, content, kind, sender_id, created_at')
    .single()

  if (error || !message) {
    logEvent('error', 'message_insert_error', { user_id: user.id, code: error?.code ?? null })
    return Response.json({ error: 'Failed to send message' }, { status: 500 })
  }

  // Best-effort: a reply from the talent advances the linked outreach and
  // application to 'responded' so the hirer's inbox, pipeline tabs and the
  // pre-hire timeline reflect it. Both writes are self-scoped - the outreach
  // update matches only the sender's own row, and mark_application_replied
  // only ever advances the caller's own application from sent/viewed - so
  // they no-op harmlessly when the sender is the hirer.
  try {
    const { data: thread } = await supabase
      .from('message_threads')
      .select('origin_outreach_id, origin_job_id')
      .eq('id', threadId)
      .maybeSingle()

    if (thread?.origin_outreach_id) {
      await supabase
        .from('outreach')
        .update({ status: 'responded' })
        .eq('id', thread.origin_outreach_id)
        .eq('talent_id', user.id)
        .in('status', ['sent', 'viewed'])
    }
    if (thread?.origin_job_id) {
      await supabase.rpc('mark_application_replied', { p_job_id: thread.origin_job_id })
    }
  } catch {
    logEvent('warn', 'message_reply_status_error', { user_id: user.id })
  }

  return Response.json({ message }, { status: 201 })
}

// PATCH /api/messages/threads/[id] — archive or unarchive my side of a thread
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: threadId } = await params
  if (!isUuid(threadId)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { archived } = parsedBody.body
  if (typeof archived !== 'boolean') return badRequest('archived must be a boolean')

  const limited = await enforceRateLimit(`threads-archive:${user.id}`, 60, 30)
  if (limited) return limited

  // Verify participant
  const { data: participant } = await supabase
    .from('thread_participants')
    .select('profile_id')
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!participant) return Response.json({ error: 'Not a participant' }, { status: 403 })

  const { error } = await supabase
    .from('thread_participants')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)

  if (error) {
    logEvent('error', 'thread_archive_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to update thread' }, { status: 500 })
  }

  return Response.json({ success: true, archived })
}
