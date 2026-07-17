// Saved searches: server-side fetching + read-time new-match counts.
// No cron, no notifications table: alerts are computed on demand by
// comparing matching talent creation times against last_viewed_at.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { filtersToDatabase } from '@/lib/search-filters'
import { mapSavedSearchRow, type SavedSearch, type SavedSearchRow } from '@/lib/saved-searches'

export type SavedSearchWithMatches = SavedSearch & {
  newMatches: number
  latestMatchAt: string | null
}

const MATCH_SCAN_LIMIT = 200

export async function fetchSavedSearches(
  supabase: SupabaseClient,
  hirerId: string,
): Promise<SavedSearch[]> {
  const { data } = await supabase
    .from('saved_searches')
    .select('id, name, query, filters, last_viewed_at, created_at')
    .eq('hirer_id', hirerId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as SavedSearchRow[]).map(mapSavedSearchRow)
}

// New matching talent since the search was last run. The structured filter
// set drives the match through the same SQL function browse uses; the
// free-text query is not re-embedded at read time (demo-scale trade-off).
export async function countNewMatches(
  search: Pick<SavedSearch, 'filters' | 'lastViewedAt'>,
): Promise<{ count: number; latestMatchAt: string | null }> {
  const service = createServiceClient()
  const { data: matches } = await service.rpc('search_talent_filtered', {
    filters: filtersToDatabase(search.filters),
    result_limit: MATCH_SCAN_LIMIT,
    result_offset: 0,
    result_sort: 'newest',
  })

  const profileIds = ((matches ?? []) as Array<{ profile_id: string }>)
    .map(row => row.profile_id)
    .filter(Boolean)
  if (profileIds.length === 0) return { count: 0, latestMatchAt: null }

  const { data: fresh } = await service
    .from('profiles')
    .select('id, created_at')
    .in('id', profileIds)
    .gt('created_at', search.lastViewedAt)
    .order('created_at', { ascending: false })

  const rows = (fresh ?? []) as Array<{ id: string; created_at: string }>
  return { count: rows.length, latestMatchAt: rows[0]?.created_at ?? null }
}

export async function fetchSavedSearchesWithNewMatches(
  supabase: SupabaseClient,
  hirerId: string,
): Promise<SavedSearchWithMatches[]> {
  const searches = await fetchSavedSearches(supabase, hirerId)
  const counts = await Promise.all(searches.map(search => countNewMatches(search)))
  return searches.map((search, index) => ({
    ...search,
    newMatches: counts[index].count,
    latestMatchAt: counts[index].latestMatchAt,
  }))
}
