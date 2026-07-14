import { createClient } from '@/lib/supabase/server'
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

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, embedding_status, embedding_error, embedding_attempts')
    .eq('hirer_id', user.id)
    .neq('embedding_status', 'complete')
    .order('created_at', { ascending: false })

  return Response.json({ jobs: jobs ?? [] })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single()
  if (profile?.account_type !== 'hirer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

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
