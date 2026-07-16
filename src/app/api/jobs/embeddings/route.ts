import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedCaller } from '@/lib/access'
import { embedJob } from '@/lib/job-embedding'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'

// GET /api/jobs/embeddings — list your jobs whose embedding is pending/failed.
// POST /api/jobs/embeddings — reprocess them (idempotent; at most 10 per call).
//
// Operational visibility + retry path for embeddings that failed or were lost.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // embedding_error stores raw upstream (OpenAI/Postgres) error text for
  // operators - never return it to the client.
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, embedding_status, embedding_attempts')
    .eq('hirer_id', user.id)
    .neq('embedding_status', 'complete')
    .order('created_at', { ascending: false })

  return Response.json({ jobs: jobs ?? [] })
}

export async function POST() {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = caller.supabase
  const user = caller.user

  // Reprocessing spends OpenAI credits - limit and meter it
  const limited =
    (await enforceRateLimit(`jobs-reembed:${user.id}`, 3600, 5)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  // Ownership is enforced by the query: only this hirer's jobs are eligible
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, description, skills_required')
    .eq('hirer_id', user.id)
    .neq('embedding_status', 'complete')
    .limit(10)

  const results: Array<{ job_id: string; status: 'complete' | 'failed' }> = []
  for (const job of jobs ?? []) {
    const { status } = await embedJob(job)
    results.push({ job_id: job.id, status })
  }

  return Response.json({ reprocessed: results })
}
