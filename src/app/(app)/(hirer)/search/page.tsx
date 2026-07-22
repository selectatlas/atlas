import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { parseSearchFilterParams } from '@/lib/search-filters'
import { fetchTalentBrowse, BROWSE_PAGE_SIZE } from '@/lib/talent-browse'
import { SearchPageContent } from '@/components/search/SearchPageContent'
import type { TalentSearchResult } from '@/types'

// Server-rendered so the browser discovers card image URLs in the initial
// HTML instead of waiting for JS to hydrate and fetch them. The (hirer)
// layout already gates access (canActAsHirer / isPlatformAdmin), so this
// just runs the same browse query the client would otherwise fetch.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const urlParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) urlParams.append(key, entry)
  }

  // AI-mode results come from the client-only search context (not this RPC),
  // so only the default browse view is worth prefetching server-side.
  const hasQuery = (urlParams.get('q') ?? '').trim().length > 0
  let initialResults: TalentSearchResult[] = []
  let initialTotal = 0

  if (!hasQuery) {
    const parsed = parseSearchFilterParams(urlParams)
    if (parsed.ok) {
      const browse = await fetchTalentBrowse(createServiceClient(), {
        filters: parsed.filters,
        limit: BROWSE_PAGE_SIZE,
        offset: 0,
        sort: urlParams.get('sort') === 'available' ? 'available' : 'newest',
      })
      if (!('error' in browse)) {
        initialResults = browse.results
        initialTotal = browse.total
      }
    }
  }

  return (
    <Suspense fallback={<div className="space-y-6 animate-pulse"><div className="h-8 w-48 rounded-lg bg-muted" /><div className="h-32 rounded-xl bg-muted" /></div>}>
      <SearchPageContent
        initialResults={initialResults}
        initialTotal={initialTotal}
        initialDataReady={!hasQuery}
      />
    </Suspense>
  )
}
