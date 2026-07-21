import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, cleanOptionalString, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { getPostHogClient } from '@/lib/posthog-server'
import { buildSystemMessageContent } from '@/lib/system-messages'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single()

  if (profile?.account_type !== 'talent') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { job_id } = parsedBody.body
  if (!isUuid(job_id)) return badRequest('job_id must be a valid id')

  const note = cleanOptionalString(parsedBody.body.note, 1000)
  if (!note.ok) return badRequest('note must be 1000 characters or fewer')
  const trimmedNote = note.value

  const limited = await enforceRateLimit(`applications:${user.id}`, 3600, 30)
  if (limited) return limited

  // Verify job exists and is open
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status, title')
    .eq('id', job_id)
    .single()

  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'open') return Response.json({ error: 'Job is closed' }, { status: 409 })

  const applicationPayload = { job_id, talent_id: user.id, status: 'sent', note: trimmedNote }
  let { data: application, error } = await supabase
    .from('applications')
    .insert(applicationPayload)
    .select()
    .single()

  // Keep existing deployments working until the optional note migration is applied.
  if (error?.code === '42703' && trimmedNote) {
    // The note is silently dropped on this path - log it so a stale schema
    // is visible instead of quietly eating user input.
    logEvent('warn', 'application_note_dropped_missing_column', { user_id: user.id })
    const fallback = await supabase
      .from('applications')
      .insert({ job_id, talent_id: user.id, status: 'sent' })
      .select()
      .single()
    application = fallback.data
    error = fallback.error
  }

  if (error) {
    // unique constraint violation = already applied
    if (error.code === '23505') {
      return Response.json({ error: 'Already applied' }, { status: 409 })
    }
    logEvent('error', 'application_insert_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to apply' }, { status: 500 })
  }

  // Best-effort system card: open (or reuse) the thread with the job's
  // hirer and drop an "application received" card into it. Never fails
  // the application itself.
  if (application) {
    try {
      const { data: threadId, error: threadError } = await supabase.rpc(
        'create_or_get_thread_for_application',
        { target_application_id: application.id },
      )
      if (threadError || !threadId) {
        logEvent('warn', 'application_system_thread_error', {
          user_id: user.id,
          code: threadError?.code ?? null,
        })
      } else {
        const { error: systemError } = await supabase.from('messages').insert({
          thread_id: threadId as string,
          sender_id: user.id,
          content: buildSystemMessageContent('application_received', { jobTitle: job.title }),
          kind: 'application_received',
        })
        if (systemError) {
          logEvent('warn', 'application_system_message_error', {
            user_id: user.id,
            code: systemError.code ?? null,
          })
        }
      }
    } catch {
      logEvent('warn', 'application_system_message_error', { user_id: user.id })
    }
  }

  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: user.id,
    event: 'job_application_submitted',
    properties: {
      job_id,
      has_note: Boolean(trimmedNote),
    },
  })
  void posthog.flush()

  return Response.json({ application }, { status: 201 })
}
