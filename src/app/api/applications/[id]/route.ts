import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid } from '@/lib/validation'
import { logEvent } from '@/lib/log'
import { buildSystemMessageContent, type SystemMessageKind } from '@/lib/system-messages'
import type { ApplicationStatus } from '@/types'

const VALID_STATUSES: ApplicationStatus[] = ['sent', 'viewed', 'responded', 'shortlisted', 'hired']

const STATUS_SYSTEM_KINDS: Partial<Record<ApplicationStatus, SystemMessageKind>> = {
  shortlisted: 'application_shortlisted',
  hired: 'application_hired',
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

  // Fetch application and verify hirer owns the job
  const { data: application } = await supabase
    .from('applications')
    .select('id, job_id, talent_id, status, jobs!job_id(hirer_id, title)')
    .eq('id', id)
    .single()

  if (!application) return Response.json({ error: 'Not found' }, { status: 404 })

  const job = application.jobs as unknown as { hirer_id: string; title: string | null } | null
  if (job?.hirer_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const status = parsedBody.body.status as ApplicationStatus
  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const previousStatus = application.status as ApplicationStatus

  const { data: updated, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 })

  // Best-effort system card when the application moves to shortlisted or
  // hired: surface the decision inside the message thread with the talent.
  const systemKind = STATUS_SYSTEM_KINDS[status]
  if (systemKind && previousStatus !== status) {
    try {
      const { data: threadId, error: threadError } = await supabase.rpc(
        'create_or_get_thread_with_origin',
        {
          other_profile_id: application.talent_id,
          origin_outreach: null,
          origin_job: application.job_id,
        },
      )
      if (threadError || !threadId) {
        logEvent('warn', 'application_status_thread_error', {
          user_id: user.id,
          code: threadError?.code ?? null,
        })
      } else {
        const { error: systemError } = await supabase.from('messages').insert({
          thread_id: threadId as string,
          sender_id: user.id,
          content: buildSystemMessageContent(systemKind, { jobTitle: job?.title }),
          kind: systemKind,
        })
        if (systemError) {
          logEvent('warn', 'application_status_message_error', {
            user_id: user.id,
            code: systemError.code ?? null,
          })
        }
      }
    } catch {
      logEvent('warn', 'application_status_message_error', { user_id: user.id })
    }
  }

  return Response.json({ application: updated })
}
