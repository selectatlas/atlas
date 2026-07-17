import { getAuthenticatedCaller } from '@/lib/access'
import { normalizeMatchScore } from '@/lib/matching'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import type { JobFeedItem } from '@/lib/job-discovery'

const STACK_SIZE = 20

// The talent's ranked "For you" stack: their profile embedding matched
// against open job embeddings (passes and applications excluded in SQL),
// with category/skill boosts on ordering. No AI spend — both embeddings
// already exist. Empty when the talent has no profile embedding yet; the
// page falls back to the regular feed.
export async function GET() {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canTalent) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { supabase, user } = caller

  const limited = await enforceRateLimit(`jobs-for-you:${user.id}`, 3600, 60)
  if (limited) return limited

  const { data: matches, error } = await supabase.rpc('match_jobs_for_talent', {
    match_count: STACK_SIZE,
  })
  if (error) {
    logEvent('error', 'jobs_for_you_rpc_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to load matches' }, { status: 500 })
  }

  const rows = (matches ?? []) as Array<{
    job_id: string
    similarity: number
    category_match: boolean
    skill_overlap: number
  }>
  if (rows.length === 0) return Response.json({ jobs: [] })

  const { data: jobRows, error: jobsError } = await supabase
    .from('jobs')
    .select('*, hirer:profiles!hirer_id(full_name)')
    .in('id', rows.map(row => row.job_id))
    .eq('status', 'open')
    .is('removed_at', null)
  if (jobsError) {
    logEvent('error', 'jobs_for_you_fetch_error', { user_id: user.id, code: jobsError.code ?? null })
    return Response.json({ error: 'Failed to load matches' }, { status: 500 })
  }

  // Preserve the RPC's boosted ranking; the displayed score stays the raw
  // similarity, normalized for display.
  const byId = new Map(((jobRows ?? []) as JobFeedItem[]).map(job => [job.id, job]))
  const jobs = rows
    .map(row => {
      const job = byId.get(row.job_id)
      if (!job) return null
      return {
        ...job,
        match_score: normalizeMatchScore(row.similarity),
        category_match: row.category_match,
        skill_overlap: row.skill_overlap,
      }
    })
    .filter(Boolean)

  return Response.json({ jobs })
}
