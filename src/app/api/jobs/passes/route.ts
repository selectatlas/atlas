import { getAuthenticatedCaller } from '@/lib/access'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

// Record that a talent passed on a job so the discover feed excludes it
// permanently, across sessions and devices. Idempotent: repeat passes on
// the same job are fine.
export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canTalent) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { supabase, user } = caller

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { job_id } = parsedBody.body
  if (!isUuid(job_id)) return badRequest('job_id must be a valid id')

  // Swiping through a deck produces bursts; keep the ceiling generous.
  const limited = await enforceRateLimit(`job-passes:${user.id}`, 3600, 500)
  if (limited) return limited

  const { error } = await supabase
    .from('job_passes')
    .upsert(
      { talent_id: user.id, job_id },
      { onConflict: 'talent_id,job_id', ignoreDuplicates: true },
    )

  if (error) {
    // Foreign key violation = the job does not exist
    if (error.code === '23503') return Response.json({ error: 'Job not found' }, { status: 404 })
    logEvent('error', 'job_pass_insert_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to save pass' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
