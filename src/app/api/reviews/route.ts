import { getAuthenticatedCaller } from '@/lib/access'
import { hasHiredTalent } from '@/lib/reviews-server'
import { SUB_RATING_KEYS } from '@/lib/reviews'
import { parseJsonBody, isUuid, badRequest, cleanString, cleanOptionalString } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { getPostHogClient } from '@/lib/posthog-server'

const REVIEW_BODY_MAX = 2000
const PROJECT_TITLE_MAX = 140

function parseScale(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < min || value > max) return null
  return value
}

// POST /api/reviews — publish a review for talent the hirer has hired.
// Two-stage payload: the public review (rating, body, optional sub-ratings)
// plus a private 0-10 recommend score that is stored but never exposed
// through the authenticated column grants.
export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { supabase, user } = caller

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.body

  const talentId = body.talent_id
  if (!isUuid(talentId)) return badRequest('talent_id must be a valid id')

  const rating = parseScale(body.rating, 1, 5)
  if (rating === null) return badRequest('rating must be a whole number between 1 and 5')

  const recommendScore = parseScale(body.recommend_score, 0, 10)
  if (recommendScore === null) return badRequest('recommend_score must be a whole number between 0 and 10')

  const reviewBody = cleanString(body.body, REVIEW_BODY_MAX)
  if (!reviewBody) return badRequest(`body must be 1-${REVIEW_BODY_MAX} characters`)

  const subRatings: Partial<Record<(typeof SUB_RATING_KEYS)[number], number | null>> = {}
  for (const key of SUB_RATING_KEYS) {
    if (body[key] === undefined || body[key] === null) {
      subRatings[key] = null
      continue
    }
    const value = parseScale(body[key], 1, 5)
    if (value === null) return badRequest(`${key} must be a whole number between 1 and 5`)
    subRatings[key] = value
  }

  const projectTitle = cleanOptionalString(body.project_title, PROJECT_TITLE_MAX)
  if (!projectTitle.ok) return badRequest(`project_title must be at most ${PROJECT_TITLE_MAX} characters`)

  const limited = await enforceRateLimit(`reviews:${user.id}`, 3600, 10)
  if (limited) return limited

  // Eligibility/ownership: the hirer must have actually hired this talent.
  // 403, never 404 — a missing relationship is a permissions failure and
  // must not leak whether the talent exists.
  const eligible = await hasHiredTalent(supabase, user.id, talentId)
  if (!eligible) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('talent_reviews')
    .insert({
      talent_id: talentId,
      reviewer_id: user.id,
      rating,
      body: reviewBody,
      project_title: projectTitle.value,
      recommend_score: recommendScore,
      ...subRatings,
    })
    .select('id')
    .single()

  if (error || !data) {
    logEvent('error', 'review_insert_error', { user_id: user.id, code: error?.code ?? null })
    return Response.json({ error: 'Failed to publish review' }, { status: 500 })
  }

  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: user.id,
    event: 'review_published',
    properties: { talent_id: talentId, rating, recommend_score: recommendScore },
  })
  void posthog.flush()

  return Response.json({ id: data.id }, { status: 201 })
}
