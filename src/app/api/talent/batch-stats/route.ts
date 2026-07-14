import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

// POST /api/talent/batch-stats — returns views + likes for multiple talent IDs
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

  // Fetch likes and views counts in parallel using Supabase RPC or raw queries
  // Since we can't easily do grouped counts in the JS client, we use two queries
  const [likesResult, viewsResult] = await Promise.all([
    supabase.from('profile_likes').select('talent_id').in('talent_id', ids),
    supabase.from('profile_views').select('talent_id').in('talent_id', ids),
  ])

  // Aggregate counts
  const likesMap: Record<string, number> = {}
  const viewsMap: Record<string, number> = {}

  for (const row of likesResult.data ?? []) {
    likesMap[row.talent_id] = (likesMap[row.talent_id] ?? 0) + 1
  }
  for (const row of viewsResult.data ?? []) {
    viewsMap[row.talent_id] = (viewsMap[row.talent_id] ?? 0) + 1
  }

  // Build response
  const stats: Record<string, { views: number; likes: number }> = {}
  for (const id of ids) {
    stats[id] = {
      views: viewsMap[id] ?? 0,
      likes: likesMap[id] ?? 0,
    }
  }

  return Response.json({ stats })
}
