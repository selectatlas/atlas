import type { createClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

// True when the hirer has at least one hired application with this talent.
// This is the eligibility gate for authoring a review: the same rule is
// enforced at the database level by the talent_reviews insert policy (018).
export async function hasHiredTalent(
  supabase: Client,
  hirerId: string,
  talentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('applications')
    .select('id, job:jobs!inner(hirer_id)')
    .eq('talent_id', talentId)
    .eq('status', 'hired')
    .eq('job.hirer_id', hirerId)
    .limit(1)

  return (data ?? []).length > 0
}
