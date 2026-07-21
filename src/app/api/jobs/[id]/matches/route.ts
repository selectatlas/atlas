import { getAuthenticatedCaller } from '@/lib/access'
import { matchTalentForJob } from '@/lib/job-matching'
import { isUuid } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { getPostHogClient } from '@/lib/posthog-server'
import type { Job } from '@/types'

// Ranked talent for one of the caller's own jobs. Kept off GET /api/jobs/[id]
// because that route side-effects applications to 'viewed' and is called from
// surfaces that have no use for matches.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })

  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response

  const supabase = caller.supabase
  const user = caller.user

  const { data: job } = await supabase.from('jobs').select('*').eq('id', id).single()
  if (!job) return Response.json({ error: 'Not found' }, { status: 404 })
  // 403 rather than 404: the caller is not the owner, and hiding existence
  // here would leak nothing they cannot already infer from the id they hold.
  if (job.hirer_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // The common path reuses the vector written at post time and spends nothing.
  // Only a job whose embedding never landed re-embeds on read, so the AI quota
  // applies to that case alone.
  const limited =
    (await enforceRateLimit(`job-matches:${user.id}`, 60, 20)) ??
    (job.embedding_status === 'complete' ? null : await enforceAiQuota(user.id))
  if (limited) return limited

  const result = await matchTalentForJob(job as Job)
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status })

  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: user.id,
    event: 'job_matches_viewed',
    properties: { job_id: id, result_count: result.results.length },
  })
  void posthog.flush()

  return Response.json({ matches: result.results })
}
