import { getAuthenticatedCaller } from '@/lib/access'
import { embedJob } from '@/lib/job-embedding'
import { parseJsonBody, cleanString, cleanOptionalString, cleanStringArray, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { getPostHogClient } from '@/lib/posthog-server'

const CATEGORIES = ['dancer', 'actor', 'photographer_videographer', 'content_creator'] as const

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

  // Rate limit job creation + daily AI quota (each job costs an embedding call)
  const limited =
    (await enforceRateLimit(`jobs-create:${user.id}`, 3600, 10)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      hirer_id: user.id,
      title,
      description,
      category,
      skills_required: skillsRequired,
      location,
      budget: budget.value,
      status: 'open',
    })
    .select()
    .single()

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
