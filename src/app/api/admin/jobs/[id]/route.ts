import { requirePlatformAdmin } from '@/lib/platform-admin'
import { parseJsonBody, cleanOptionalString, badRequest, isUuid } from '@/lib/validation'
import { logEvent } from '@/lib/log'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const { action } = parsedBody.body
  if (action !== 'remove' && action !== 'restore') {
    return badRequest('action must be remove or restore')
  }

  const reason = cleanOptionalString(parsedBody.body.reason, 500)
  if (!reason.ok) return badRequest('reason must be 500 characters or fewer')

  if (action === 'remove' && !reason.value) {
    return badRequest('reason is required when removing a job')
  }

  const patch =
    action === 'remove'
      ? {
          removed_at: new Date().toISOString(),
          removal_reason: reason.value,
          status: 'closed' as const,
        }
      : {
          removed_at: null,
          removal_reason: null,
        }

  const { data: job, error } = await auth.service
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .select('id, title, status, removed_at, removal_reason')
    .single()

  if (error || !job) {
    logEvent('error', 'admin_job_moderation_failed', { job_id: id, code: error?.code ?? null })
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  logEvent('warn', 'admin_job_moderation', {
    job_id: id,
    action,
    admin_id: auth.userId,
  })

  return Response.json({ job })
}
