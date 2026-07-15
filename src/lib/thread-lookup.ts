import type { SupabaseClient } from '@supabase/supabase-js'

/** Find an existing DM thread between the current user and another profile. */
export async function findThreadWithOther(
  supabase: SupabaseClient,
  userId: string,
  otherProfileId: string,
): Promise<string | null> {
  const { data: mine } = await supabase
    .from('thread_participants')
    .select('thread_id')
    .eq('profile_id', userId)

  const myThreadIds = (mine ?? []).map(row => row.thread_id as string)
  if (myThreadIds.length === 0) return null

  const { data: shared } = await supabase
    .from('thread_participants')
    .select('thread_id')
    .in('thread_id', myThreadIds)
    .eq('profile_id', otherProfileId)
    .limit(1)
    .maybeSingle()

  return (shared?.thread_id as string | undefined) ?? null
}
