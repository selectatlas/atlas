import type { createClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

export interface ReviewAllowance {
  hiredCount: number
  reviewCount: number
  canReview: boolean
}

// Review authoring is budgeted per booking: a hirer may publish at most one
// review per hired application with this talent. The same rule is enforced
// at the database level by the talent_reviews insert policy (020), so this
// helper only exists to gate the UI and return friendly API errors.
export async function getReviewAllowance(
  supabase: Client,
  hirerId: string,
  talentId: string,
): Promise<ReviewAllowance> {
  const [hiredResult, reviewResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, job:jobs!inner(hirer_id)', { count: 'exact', head: true })
      .eq('talent_id', talentId)
      .eq('status', 'hired')
      .eq('job.hirer_id', hirerId),
    supabase
      .from('talent_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('talent_id', talentId)
      .eq('reviewer_id', hirerId),
  ])

  const hiredCount = hiredResult.count ?? 0
  const reviewCount = reviewResult.count ?? 0
  return { hiredCount, reviewCount, canReview: hiredCount > 0 && reviewCount < hiredCount }
}
