import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { buildTalentLevelMetrics, computeTalentLevel, type TalentLevel } from '@/lib/talent-level'

// POST /api/talent/batch-stats — returns views, likes and the computed talent
// level for multiple talent IDs (one call per visible result page).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { ids } = parsedBody.body

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ stats: {} })
  }
  if (ids.length > 50 || !ids.every(isUuid)) {
    return badRequest('ids must be at most 50 valid ids')
  }

  const limited = await enforceRateLimit(`batch-stats:${user.id}`, 60, 30)
  if (limited) return limited

  // Level inputs (review aggregates, hired applications, outreach responses)
  // are cross-tenant reads, so they go through the service client after the
  // auth check above. Likes/views stay on the caller's RLS-scoped client.
  const service = createServiceClient()
  const [likesResult, viewsResult, reviewStatsResult, hiredResult, outreachResult] = await Promise.all([
    supabase.from('profile_likes').select('talent_id').in('talent_id', ids),
    supabase.from('profile_views').select('talent_id').in('talent_id', ids),
    service.from('talent_stats').select('profile_id, review_count, avg_rating').in('profile_id', ids),
    service.from('applications').select('talent_id').eq('status', 'hired').in('talent_id', ids),
    service.from('outreach').select('talent_id, status').neq('status', 'draft').in('talent_id', ids),
  ])

  // Aggregate counts
  const likesMap: Record<string, number> = {}
  const viewsMap: Record<string, number> = {}
  const hiredMap: Record<string, number> = {}
  const contactedMap: Record<string, number> = {}
  const respondedMap: Record<string, number> = {}
  const reviewMap: Record<string, { count: number; average: number | null }> = {}

  for (const row of likesResult.data ?? []) {
    likesMap[row.talent_id] = (likesMap[row.talent_id] ?? 0) + 1
  }
  for (const row of viewsResult.data ?? []) {
    viewsMap[row.talent_id] = (viewsMap[row.talent_id] ?? 0) + 1
  }
  for (const row of (reviewStatsResult.data ?? []) as Array<{ profile_id: string; review_count: number | null; avg_rating: number | string | null }>) {
    reviewMap[row.profile_id] = {
      count: row.review_count ?? 0,
      average: row.avg_rating == null ? null : Number(row.avg_rating),
    }
  }
  for (const row of (hiredResult.data ?? []) as Array<{ talent_id: string }>) {
    hiredMap[row.talent_id] = (hiredMap[row.talent_id] ?? 0) + 1
  }
  for (const row of (outreachResult.data ?? []) as Array<{ talent_id: string; status: string }>) {
    contactedMap[row.talent_id] = (contactedMap[row.talent_id] ?? 0) + 1
    if (row.status === 'responded') {
      respondedMap[row.talent_id] = (respondedMap[row.talent_id] ?? 0) + 1
    }
  }

  // Build response
  const stats: Record<string, { views: number; likes: number; level: TalentLevel }> = {}
  for (const id of ids) {
    const reviews = reviewMap[id]
    stats[id] = {
      views: viewsMap[id] ?? 0,
      likes: likesMap[id] ?? 0,
      level: computeTalentLevel(buildTalentLevelMetrics({
        reviewAverage: reviews?.average ?? null,
        reviewCount: reviews?.count ?? 0,
        hiredCount: hiredMap[id] ?? 0,
        contactedCount: contactedMap[id] ?? 0,
        respondedCount: respondedMap[id] ?? 0,
      })),
    }
  }

  return Response.json({ stats })
}
