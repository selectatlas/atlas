import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, cleanOptionalString, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

const REASONS = ['spam', 'harassment', 'impersonation', 'inappropriate_content', 'scam', 'other'] as const

// POST /api/reports — report a user or a job for review.
// Creates an auditable case; reviewed by the named moderation owner (see
// docs/launch-checklist.md step 20).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { reported_profile_id, reported_job_id, reason } = parsedBody.body

  if (reported_profile_id === undefined && reported_job_id === undefined) {
    return badRequest('reported_profile_id or reported_job_id is required')
  }
  if (reported_profile_id !== undefined && !isUuid(reported_profile_id)) {
    return badRequest('reported_profile_id must be a valid id')
  }
  if (reported_job_id !== undefined && !isUuid(reported_job_id)) {
    return badRequest('reported_job_id must be a valid id')
  }
  if (reported_profile_id === user.id) {
    return badRequest('You cannot report yourself')
  }
  if (typeof reason !== 'string' || !REASONS.includes(reason as typeof REASONS[number])) {
    return badRequest(`reason must be one of: ${REASONS.join(', ')}`)
  }
  const details = cleanOptionalString(parsedBody.body.details, 2000)
  if (!details.ok) return badRequest('details must be 2000 characters or fewer')

  const limited = await enforceRateLimit(`reports:${user.id}`, 3600, 10)
  if (limited) return limited

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      reported_profile_id: reported_profile_id ?? null,
      reported_job_id: reported_job_id ?? null,
      reason,
      details: details.value,
    })
    .select('id, status, created_at')
    .single()

  if (error || !report) {
    logEvent('error', 'report_insert_error', { user_id: user.id, code: error?.code ?? null })
    return Response.json({ error: 'Failed to submit report' }, { status: 500 })
  }

  logEvent('warn', 'abuse_report_created', {
    report_id: report.id,
    reason,
    has_profile: Boolean(reported_profile_id),
    has_job: Boolean(reported_job_id),
  })

  return Response.json({ report }, { status: 201 })
}
