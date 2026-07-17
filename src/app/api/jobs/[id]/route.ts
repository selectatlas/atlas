import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid } from '@/lib/validation'
import { buildSystemMessageContent } from '@/lib/system-messages'
import { findThreadWithOther } from '@/lib/thread-lookup'
import { logEvent } from '@/lib/log'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !job) return Response.json({ error: 'Not found' }, { status: 404 })
  if (job.hirer_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Opening the job detail is the hirer seeing the applicants: advance new
  // applications to 'viewed' so the inbox unread badge clears and the
  // pipeline tabs reflect reality. Runs before the select so the response
  // carries the post-view statuses.
  await supabase
    .from('applications')
    .update({ status: 'viewed' })
    .eq('job_id', id)
    .eq('status', 'sent')

  const { data: applications } = await supabase
    .from('applications')
    .select('*, profiles!talent_id(id, full_name, avatar_url, city, country, talent_skills(*))')
    .eq('job_id', id)
    .order('created_at', { ascending: false })

  return Response.json({ job, applications: applications ?? [] })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase
    .from('jobs')
    .select('hirer_id, title, status')
    .eq('id', id)
    .single()

  if (!job) return Response.json({ error: 'Not found' }, { status: 404 })
  if (job.hirer_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { status } = parsedBody.body
  if (status !== 'open' && status !== 'closed') {
    return Response.json({ error: 'status must be open or closed' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 })

  // Best-effort: closing a role tells applicants still in flight, so their
  // application doesn't just silently vanish from discover. Existing threads
  // only - closing a job is not a reason to open new conversations.
  if (job.status === 'open' && status === 'closed') {
    try {
      const { data: pending } = await supabase
        .from('applications')
        .select('talent_id')
        .eq('job_id', id)
        .in('status', ['sent', 'viewed', 'responded'])

      for (const application of pending ?? []) {
        const threadId = await findThreadWithOther(supabase, user.id, application.talent_id as string)
        if (!threadId) continue
        await supabase.from('messages').insert({
          thread_id: threadId,
          sender_id: user.id,
          content: buildSystemMessageContent('job_closed', { jobTitle: job.title }),
          kind: 'job_closed',
        })
      }
    } catch {
      logEvent('warn', 'job_closed_message_error', { user_id: user.id })
    }
  }

  return Response.json({ job: updated })
}
