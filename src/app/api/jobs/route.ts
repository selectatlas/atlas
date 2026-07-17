import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedCaller } from '@/lib/access'
import { createServiceClient } from '@/lib/supabase/server'
import { embedJob } from '@/lib/job-embedding'
import { embedText } from '@/lib/openai'
import { parseBudgetRange, parseDiscoverParams, fetchDiscoverJobs, MAX_EXCLUDED_PASSES, type DiscoverFilters, type JobFeedItem } from '@/lib/job-discovery'
import { normalizeMatchScore } from '@/lib/matching'
import { parseJsonBody, cleanString, cleanOptionalString, cleanStringArray, cleanOptionalDate, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { getPostHogClient } from '@/lib/posthog-server'

const CATEGORIES = ['dancer', 'actor', 'photographer_videographer', 'content_creator'] as const
const WORK_TYPES = ['remote', 'hybrid', 'in_person'] as const

// Paginated open-jobs feed for the talent discover page. Filtering, sorting,
// and keyset pagination run in Postgres; passed jobs are excluded for the
// calling talent. Any authenticated user may list (jobs are select-all).
export async function GET(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  const { supabase, user } = caller

  const limited = await enforceRateLimit(`jobs-list:${user.id}`, 60, 60)
  if (limited) return limited

  const parsed = parseDiscoverParams(new URL(request.url).searchParams)
  if (!parsed.ok) return badRequest(parsed.error)

  let excludeJobIds: string[] = []
  if (caller.access.canTalent) {
    const { data: passes } = await supabase
      .from('job_passes')
      .select('job_id')
      .eq('talent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_EXCLUDED_PASSES)
    excludeJobIds = (passes ?? []).map(pass => pass.job_id as string)
  }

  // Relevance sort with a search term = semantic ranking: embed the query
  // and rank by vector similarity. Falls through to the keyset feed (FTS,
  // newest-first) if embedding or the RPC fails, so search never breaks.
  if (parsed.filters.sort === 'relevance' && parsed.filters.search && !parsed.countOnly && !parsed.cursor) {
    const quotaLimited = await enforceAiQuota(user.id)
    if (quotaLimited) return quotaLimited
    const semantic = await runSemanticJobSearch(supabase, parsed.filters, excludeJobIds, user.id)
    if (semantic) return Response.json(semantic)
  }

  const result = await fetchDiscoverJobs(supabase, parsed.filters, {
    cursor: parsed.cursor,
    excludeJobIds,
    countOnly: parsed.countOnly,
  })
  if (!result.ok) {
    logEvent('error', 'jobs_list_error', { user_id: user.id })
    return Response.json({ error: 'Failed to load jobs' }, { status: 500 })
  }

  return Response.json(result.page)
}

// Semantic job search: top-N by cosine similarity with structured filters
// applied in SQL. Returns null on any failure so the caller can fall back.
async function runSemanticJobSearch(
  supabase: SupabaseClient,
  filters: DiscoverFilters,
  excludeJobIds: string[],
  userId: string,
) {
  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedText(filters.search)
  } catch (err) {
    logEvent('error', 'jobs_semantic_embed_error', {
      user_id: userId,
      message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    })
    return null
  }

  const service = createServiceClient()
  const { data: matches, error } = await service.rpc('match_jobs_filtered', {
    query_embedding: queryEmbedding,
    filters: {
      ...(filters.categories.length > 0 ? { categories: filters.categories } : {}),
      ...(filters.workType !== 'all' ? { work_type: filters.workType } : {}),
      ...(filters.location ? { location: filters.location } : {}),
      ...(filters.budgetBand !== 'any' ? { rate: filters.budgetBand } : {}),
    },
    exclude_ids: excludeJobIds,
    match_count: 50,
  })
  if (error) {
    logEvent('error', 'jobs_semantic_rpc_error', { user_id: userId, code: error.code ?? null })
    return null
  }

  const rows = (matches ?? []) as Array<{ job_id: string; similarity: number }>
  if (rows.length === 0) return { jobs: [], nextCursor: null, total: 0 }

  // Fetch through the caller's client so RLS still applies to the job rows.
  const { data: jobRows, error: jobsError } = await supabase
    .from('jobs')
    .select('*, hirer:profiles!hirer_id(full_name)')
    .in('id', rows.map(row => row.job_id))
    .eq('status', 'open')
    .is('removed_at', null)
  if (jobsError) {
    logEvent('error', 'jobs_semantic_fetch_error', { user_id: userId, code: jobsError.code ?? null })
    return null
  }

  const similarity = new Map(rows.map(row => [row.job_id, row.similarity]))
  const jobs = ((jobRows ?? []) as JobFeedItem[])
    .sort((a, b) => (similarity.get(b.id) ?? 0) - (similarity.get(a.id) ?? 0))
    .map(job => ({ ...job, match_score: normalizeMatchScore(similarity.get(job.id) ?? 0) }))

  return { jobs, nextCursor: null, total: jobs.length }
}

export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = caller.supabase
  const user = caller.user

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.body

  const title = cleanString(body.title, 200)
  const description = cleanString(body.description, 5000)
  const location = cleanString(body.location, 200)
  const budget = cleanOptionalString(body.budget, 100)
  const skillsRequired = cleanStringArray(body.skills_required, 20, 50)
  const category = body.category

  if (!title) return badRequest('title is required (max 200 characters)')
  if (!description) return badRequest('description is required (max 5000 characters)')
  if (!location) return badRequest('location is required (max 200 characters)')
  if (!budget.ok) return badRequest('budget must be 100 characters or fewer')
  if (!skillsRequired) return badRequest('skills_required must be at most 20 skills of 50 characters each')
  if (typeof category !== 'string' || !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    return badRequest(`category must be one of: ${CATEGORIES.join(', ')}`)
  }

  const workType = body.work_type ?? null
  const startDate = cleanOptionalDate(body.start_date)
  const endDate = cleanOptionalDate(body.end_date)
  const applicationDeadline = cleanOptionalDate(body.application_deadline)
  const duration = cleanOptionalString(body.duration, 200)
  const usageRights = cleanOptionalString(body.usage_rights, 500)
  const travelRequired = body.travel_required ?? false

  if (workType !== null && !WORK_TYPES.includes(workType as typeof WORK_TYPES[number])) {
    return badRequest(`work_type must be one of: ${WORK_TYPES.join(', ')}`)
  }
  if (!startDate.ok) return badRequest('start_date must be a YYYY-MM-DD date')
  if (!endDate.ok) return badRequest('end_date must be a YYYY-MM-DD date')
  if (!applicationDeadline.ok) return badRequest('application_deadline must be a YYYY-MM-DD date')
  if (!duration.ok) return badRequest('duration must be 200 characters or fewer')
  if (!usageRights.ok) return badRequest('usage_rights must be 500 characters or fewer')
  if (typeof travelRequired !== 'boolean') return badRequest('travel_required must be a boolean')

  // Rate limit job creation + daily AI quota (each job costs an embedding call)
  const limited =
    (await enforceRateLimit(`jobs-create:${user.id}`, 3600, 10)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  const budgetBounds = parseBudgetRange(budget.value)
  const jobRow = {
    hirer_id: user.id,
    title,
    description,
    category,
    skills_required: skillsRequired,
    location,
    budget: budget.value,
    budget_min: budgetBounds.min,
    budget_max: budgetBounds.max,
    status: 'open',
    work_type: workType,
    start_date: startDate.value,
    end_date: endDate.value,
    application_deadline: applicationDeadline.value,
    duration: duration.value,
    usage_rights: usageRights.value,
    travel_required: travelRequired,
  }

  let { data: job, error } = await supabase
    .from('jobs')
    .insert(jobRow)
    .select()
    .single()

  // Keep existing deployments working until migration 021 (budget bounds)
  // is applied: retry without the structured columns (undefined properties
  // are dropped from the insert payload).
  if (error?.code === '42703') {
    const fallback = await supabase
      .from('jobs')
      .insert({ ...jobRow, budget_min: undefined, budget_max: undefined })
      .select()
      .single()
    job = fallback.data
    error = fallback.error
  }

  if (error || !job) {
    logEvent('error', 'job_insert_error', { user_id: user.id, code: error?.code ?? null })
    return Response.json({ error: 'Failed to create job' }, { status: 500 })
  }

  // Await the embedding so a stopped serverless worker cannot silently drop
  // it. On failure the job still posts - status is recorded and retryable
  // via POST /api/jobs/embeddings.
  const embedding = await embedJob(job)

  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: user.id,
    event: 'job_created',
    properties: {
      job_id: job.id,
      category: job.category,
      has_budget: Boolean(job.budget),
      skills_count: skillsRequired?.length ?? 0,
    },
  })
  void posthog.flush()

  return Response.json({ job: { ...job, embedding_status: embedding.status } }, { status: 201 })
}
