import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSavedSearchHref, describeSavedSearch } from '@/lib/saved-searches'
import { fetchSavedSearchesWithNewMatches } from '@/lib/saved-searches-server'
import { SavedSearchList } from '@/components/search/SavedSearchList'

// Hirer home: saved searches with read-time new-match counts.
// Renders nothing until the hirer has saved at least one search.
export async function SavedSearchesSection({
  supabase,
  hirerId,
}: {
  supabase: SupabaseClient
  hirerId: string
}) {
  const searches = await fetchSavedSearchesWithNewMatches(supabase, hirerId)
  if (searches.length === 0) return null

  const items = searches.map(search => ({
    id: search.id,
    name: search.name,
    description: describeSavedSearch(search),
    href: buildSavedSearchHref(search),
    newMatches: search.newMatches,
  }))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Saved searches</h2>
        <p className="text-xs text-muted-foreground">Atlas keeps scouting for you</p>
      </div>
      <SavedSearchList items={items} />
    </div>
  )
}
