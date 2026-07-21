import { getAuthenticatedCaller } from '@/lib/access'
import { parseJobDraft } from '@/lib/openai'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { getPostHogClient } from '@/lib/posthog-server'

// Drafts a job post from one sentence of hirer intent. The draft is never
// persisted: it prefills the review form, and POST /api/jobs remains the only
// path that writes a job (and re-validates every field).
export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const user = caller.user

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const brief = cleanString(parsedBody.body.brief, 1000)
  if (!brief) return badRequest('brief is required (max 1000 characters)')

  // Both limits land before any OpenAI spend.
  const limited =
    (await enforceRateLimit(`jobs-draft:${user.id}`, 60, 10)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  try {
    // Server-side date so relative timing in the brief ("first week of
    // September") resolves against real time, not the client's clock.
    const today = new Date().toISOString().slice(0, 10)
    const draft = await parseJobDraft(brief, today)

    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: user.id,
      event: 'job_draft_generated',
      properties: {
        category: draft.category,
        has_budget: Boolean(draft.budget),
        has_location: Boolean(draft.location),
        skills_count: draft.skills_required.length,
        brief_length: brief.length,
      },
    })
    void posthog.flush()

    return Response.json({ draft })
  } catch (err) {
    logEvent('error', 'job_draft_error', {
      user_id: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return Response.json({ error: 'Drafting is temporarily unavailable' }, { status: 503 })
  }
}
