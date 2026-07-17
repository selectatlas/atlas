import { getAuthenticatedCaller } from '@/lib/access'
import { parseJsonBody, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { fetchDiscoverJobs } from '@/lib/job-discovery'
import { MAX_JOB_ALERTS, alertToDiscoverFilters, mapJobAlertRow, parseJobAlertInput, type JobAlertRow } from '@/lib/job-alerts'

// GET /api/jobs/alerts — list my job alerts with read-time new-match counts
// (jobs created since each alert's last_viewed_at). Talent only.
export async function GET() {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canTalent) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { supabase, user } = caller

  const { data, error } = await supabase
    .from('job_alerts')
    .select('id, name, query, filters, last_viewed_at, created_at')
    .eq('talent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_JOB_ALERTS)

  if (error) {
    logEvent('error', 'job_alerts_list_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to load alerts' }, { status: 500 })
  }

  const rows = (data ?? []) as JobAlertRow[]
  const alerts = await Promise.all(
    rows.map(async row => {
      const filters = alertToDiscoverFilters({ query: row.query, filters: mapJobAlertRow(row).filters })
      if (!filters.ok) return mapJobAlertRow(row, 0)
      const counted = await fetchDiscoverJobs(supabase, filters.filters, {
        cursor: null,
        countOnly: true,
        createdAfter: row.last_viewed_at,
      })
      return mapJobAlertRow(row, counted.ok ? counted.page.total ?? 0 : 0)
    }),
  )

  return Response.json({ alerts })
}

// POST /api/jobs/alerts — save the current search/filters as an alert. Talent only.
export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canTalent) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { supabase, user } = caller

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const parsed = parseJobAlertInput(parsedBody.body)
  if (!parsed.ok) return badRequest(parsed.error)

  const limited = await enforceRateLimit(`job-alerts:${user.id}`, 3600, 30)
  if (limited) return limited

  const { count } = await supabase
    .from('job_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('talent_id', user.id)
  if ((count ?? 0) >= MAX_JOB_ALERTS) {
    return badRequest(`You can keep up to ${MAX_JOB_ALERTS} job alerts. Delete one first.`)
  }

  const { data, error } = await supabase
    .from('job_alerts')
    .insert({
      talent_id: user.id,
      name: parsed.input.name,
      query: parsed.input.query,
      filters: parsed.input.filters,
    })
    .select('id, name, query, filters, last_viewed_at, created_at')
    .single()

  if (error || !data) {
    logEvent('error', 'job_alert_insert_error', { user_id: user.id, code: error?.code ?? null })
    return Response.json({ error: 'Failed to save alert' }, { status: 500 })
  }

  return Response.json({ alert: mapJobAlertRow(data as JobAlertRow) }, { status: 201 })
}
