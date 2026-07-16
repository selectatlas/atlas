import { requirePlatformAdmin } from '@/lib/platform-admin'
import { parseJsonBody, cleanOptionalString, badRequest, isUuid } from '@/lib/validation'
import { logEvent } from '@/lib/log'
import type { ReportStatus } from '@/types'

const STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const limitRaw = Number(url.searchParams.get('limit') ?? 50)
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50))

  let query = auth.service
    .from('reports')
    .select(`
      id,
      reporter_id,
      reported_profile_id,
      reported_job_id,
      reason,
      details,
      status,
      admin_notes,
      resolved_by,
      resolved_at,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && STATUSES.includes(status as typeof STATUSES[number])) {
    query = query.eq('status', status)
  }

  const { data: reports, error } = await query
  if (error) {
    logEvent('error', 'admin_reports_list_failed', { code: error.code })
    return Response.json({ error: 'Failed to load reports' }, { status: 500 })
  }

  const rows = reports ?? []
  const profileIds = [
    ...rows.map(r => r.reporter_id),
    ...rows.flatMap(r => (r.reported_profile_id ? [r.reported_profile_id] : [])),
  ]
  const jobIds = rows.flatMap(r => (r.reported_job_id ? [r.reported_job_id] : []))

  const [{ data: profiles }, { data: jobs }] = await Promise.all([
    profileIds.length > 0
      ? auth.service.from('profiles').select('id, full_name, email, account_type').in('id', [...new Set(profileIds)])
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; email: string; account_type: string }> }),
    jobIds.length > 0
      ? auth.service.from('jobs').select('id, title, status, hirer_id').in('id', [...new Set(jobIds)])
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; status: string; hirer_id: string }> }),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const jobMap = new Map((jobs ?? []).map(j => [j.id, j]))

  const enriched = rows.map(report => ({
    ...report,
    reporter: profileMap.get(report.reporter_id) ?? null,
    reported_profile: report.reported_profile_id ? profileMap.get(report.reported_profile_id) ?? null : null,
    reported_job: report.reported_job_id ? jobMap.get(report.reported_job_id) ?? null : null,
  }))

  return Response.json({ reports: enriched })
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const { id, status } = parsedBody.body
  if (!isUuid(id)) return badRequest('id must be a valid uuid')
  if (typeof status !== 'string' || !STATUSES.includes(status as ReportStatus)) {
    return badRequest(`status must be one of: ${STATUSES.join(', ')}`)
  }

  const adminNotes = cleanOptionalString(parsedBody.body.admin_notes, 2000)
  if (!adminNotes.ok) return badRequest('admin_notes must be 2000 characters or fewer')

  const resolvedAt = status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null

  const { data: report, error } = await auth.service
    .from('reports')
    .update({
      status,
      admin_notes: adminNotes.value,
      resolved_by: resolvedAt ? auth.userId : null,
      resolved_at: resolvedAt,
    })
    .eq('id', id)
    .select('id, status, admin_notes, resolved_by, resolved_at')
    .single()

  if (error || !report) {
    logEvent('error', 'admin_report_update_failed', { report_id: String(id), code: error?.code ?? null })
    return Response.json({ error: 'Failed to update report' }, { status: 500 })
  }

  logEvent('info', 'admin_report_updated', {
    report_id: report.id,
    status: report.status,
    admin_id: auth.userId,
  })

  return Response.json({ report })
}
