import { requirePlatformAdmin } from '@/lib/platform-admin'
import { embedJob } from '@/lib/job-embedding'
import { parseJsonBody, cleanString, cleanOptionalString, cleanStringArray, badRequest, isUuid } from '@/lib/validation'
import { logEvent } from '@/lib/log'
import type { Category } from '@/types'

const CATEGORIES = ['dancer', 'actor', 'photographer_videographer', 'content_creator'] as const

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const title = cleanString(parsedBody.body.title, 200)
  const description = cleanString(parsedBody.body.description, 5000)
  const location = cleanString(parsedBody.body.location, 200)
  const budget = cleanOptionalString(parsedBody.body.budget, 100)
  const skillsRequired = cleanStringArray(parsedBody.body.skills_required, 20, 50)
  const category = parsedBody.body.category
  const hirerId = parsedBody.body.hirer_id

  if (!title) return badRequest('title is required (max 200 characters)')
  if (!description) return badRequest('description is required (max 5000 characters)')
  if (!location) return badRequest('location is required (max 200 characters)')
  if (!budget.ok) return badRequest('budget must be 100 characters or fewer')
  if (!skillsRequired) return badRequest('skills_required must be at most 20 skills of 50 characters each')
  if (typeof category !== 'string' || !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    return badRequest(`category must be one of: ${CATEGORIES.join(', ')}`)
  }
  if (typeof hirerId !== 'string' || !isUuid(hirerId)) {
    return badRequest('hirer_id must be a valid UUID')
  }

  const { data: hirer } = await auth.service
    .from('profiles')
    .select('id, account_type, suspended_at')
    .eq('id', hirerId)
    .maybeSingle()

  if (!hirer) return badRequest('Hirer not found')
  if (hirer.account_type !== 'hirer') return badRequest('Selected user is not a hirer account')
  if (hirer.suspended_at) return badRequest('Cannot post jobs for a suspended hirer')

  const { data: job, error } = await auth.service
    .from('jobs')
    .insert({
      hirer_id: hirerId,
      title,
      description,
      category: category as Category,
      skills_required: skillsRequired,
      location,
      budget: budget.value,
      status: 'open',
    })
    .select()
    .single()

  if (error || !job) {
    logEvent('error', 'admin_job_create_failed', { hirer_id: hirerId, code: error?.code ?? null })
    return Response.json({ error: 'Failed to create job' }, { status: 500 })
  }

  const embedding = await embedJob(job)

  logEvent('info', 'admin_job_created', {
    job_id: job.id,
    hirer_id: hirerId,
    admin_id: auth.userId,
  })

  return Response.json({ job: { ...job, embedding_status: embedding.status } }, { status: 201 })
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const removed = url.searchParams.get('removed')
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))

  let query = auth.service
    .from('jobs')
    .select(`
      id,
      title,
      category,
      location,
      status,
      hirer_id,
      removed_at,
      removal_reason,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (removed === 'true') {
    query = query.not('removed_at', 'is', null)
  } else if (removed === 'false') {
    query = query.is('removed_at', null)
  }

  const { data: jobs, error } = await query
  if (error) {
    logEvent('error', 'admin_jobs_list_failed', { code: error.code })
    return Response.json({ error: 'Failed to load jobs' }, { status: 500 })
  }

  const rows = jobs ?? []
  const hirerIds = [...new Set(rows.map(j => j.hirer_id))]
  const { data: hirers } = hirerIds.length > 0
    ? await auth.service.from('profiles').select('id, full_name, email').in('id', hirerIds)
    : { data: [] as Array<{ id: string; full_name: string; email: string }> }

  const hirerMap = new Map((hirers ?? []).map(h => [h.id, h]))
  const enriched = rows.map(job => ({
    ...job,
    hirer: hirerMap.get(job.hirer_id) ?? null,
  }))

  return Response.json({ jobs: enriched })
}
