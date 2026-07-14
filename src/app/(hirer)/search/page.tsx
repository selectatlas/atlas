'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SearchX, Sparkles } from 'lucide-react'
import { TalentCard, TalentListItem } from '@/components/talent/TalentCard'
import { SearchHeader } from '@/components/search/SearchHeader'
import { SwipeStack } from '@/components/talent/SwipeStack'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { Skeleton } from '@/components/ui/skeleton'
import { DEMO_TALENT_ATTRIBUTES, filterDemoTalent, searchDemoTalent } from '@/lib/demo-data'
import { serializeSearchFilters, type SearchFilters } from '@/lib/search-filters'
import { useSearchFilters } from '@/components/search/useSearchFilters'
import type { Profile, TalentSkill, TalentSearchResult } from '@/types'

type ViewMode = 'swipe' | 'grid' | 'list'
type SortMode = 'newest' | 'available'

export default function SearchPage() {
  const router = useRouter()
  const { filters, setFilters } = useSearchFilters()

  const [allTalent, setAllTalent] = useState<TalentSearchResult[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [browseTotal, setBrowseTotal] = useState(0)
  const [browseLoading, setBrowseLoading] = useState(true)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [browseRetry, setBrowseRetry] = useState(0)

  const [query, setQuery] = useState('')
  const [aiResults, setAiResults] = useState<TalentSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [outreachTalent, setOutreachTalent] = useState<(Profile & { talent_skills: TalentSkill[] }) | null>(null)
  const [passed, setPassed] = useState<Set<string>>(new Set())

  const [talentStats, setTalentStats] = useState<Record<string, { views: number; likes: number }>>({})
  const [isLocalDemo, setIsLocalDemo] = useState(false)

  useEffect(() => {
    const localDemo = process.env.NODE_ENV === 'development' && document.cookie.includes('atlas_demo=1')
    // The cookie is the local demo's external session source; hydrate it once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLocalDemo(localDemo)

    if (localDemo) {
      let profiles = filterDemoTalent(filters)
      if (sortMode === 'available') profiles = [...profiles].sort((a, b) => Number(Boolean(DEMO_TALENT_ATTRIBUTES[b.id]?.available_now)) - Number(Boolean(DEMO_TALENT_ATTRIBUTES[a.id]?.available_now)))
      setAllTalent(profiles.map(profile => ({ profile, match_score: 0 })))
      setBrowseTotal(profiles.length)
      setBrowseLoading(false)
      return
    }

    const controller = new AbortController()
    const params = serializeSearchFilters(filters)
    params.set('limit', '48')
    params.set('sort', sortMode === 'available' ? 'available' : 'newest')
    setBrowseLoading(true)
    setBrowseError(null)
    fetch(`/api/talent?${params.toString()}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Unable to load talent')))
      .then(data => {
        setAllTalent(data.results ?? [])
        setBrowseTotal(data.total ?? 0)
      })
      .catch(error => { if (error.name !== 'AbortError') setBrowseError('Unable to load talent') })
      .finally(() => { if (!controller.signal.aborted) setBrowseLoading(false) })
    return () => controller.abort()
  }, [browseRetry, filters, sortMode])

  useEffect(() => {
    const results = aiResults ?? allTalent
    if (results.length === 0) return
    const ids = results.map(r => r.profile.id)
    fetch('/api/talent/batch-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then(r => r.json())
      .then(data => setTalentStats(data.stats ?? {}))
      .catch(() => { /* silent */ })
  }, [allTalent, aiResults])

  const runAiSearch = useCallback(async (q: string) => {
    aiAbortRef.current?.abort()
    if (!q.trim()) { setAiResults(null); setSearchTime(null); setSearching(false); return }
    const controller = new AbortController()
    aiAbortRef.current = controller
    setSearching(true)
    setAiError(null)
    const t0 = Date.now()

    if (isLocalDemo) {
      setAiResults(searchDemoTalent(q, filters))
      setSearchTime(Date.now() - t0)
      setSearching(false)
      return
    }

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, filters }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.error) { setAiError(data.error) }
      else {
        setAiResults(data.results ?? [])
        setSearchTime(Date.now() - t0)
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setAiError('Search failed')
    }
    if (aiAbortRef.current === controller) setSearching(false)
  }, [filters, isLocalDemo])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!query.trim()) { setAiResults(null); setSearchTime(null); return }
    debounceRef.current = setTimeout(() => runAiSearch(query), 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      aiAbortRef.current?.abort()
    }
  }, [query, runAiSearch])

  const isAiMode = query.trim().length > 0
  // Browse results are already stably ordered by the filtered SQL function.
  // Keeping that order is especially important for `available`, which uses
  // the structured `available_now` field that is intentionally not public.
  const displayResults = (isAiMode ? (aiResults ?? []) : allTalent).filter(r => !passed.has(r.profile.id))
  const loadingResults = searching || (!isAiMode && browseLoading)

  const previewCount = useCallback(async (previewFilters: SearchFilters) => {
    if (isLocalDemo) return filterDemoTalent(previewFilters).length
    const params = serializeSearchFilters(previewFilters)
    params.set('limit', '1')
    const response = await fetch(`/api/talent?${params.toString()}`)
    if (!response.ok) throw new Error('Unable to preview filters')
    const data = await response.json()
    return Number(data.total ?? 0)
  }, [isLocalDemo])

  function handleContact(talent: Profile & { talent_skills: TalentSkill[] }) {
    setOutreachTalent(talent)
  }

  function handlePass(talentId: string) {
    setPassed(s => new Set([...s, talentId]))
  }

  return (
    <div className="space-y-6 py-2">
      <SearchHeader
        query={query}
        onQueryChange={setQuery}
        onClearQuery={() => { setQuery(''); setAiResults(null) }}
        searching={searching}
        isAiMode={isAiMode}
        filters={filters}
        onFiltersChange={setFilters}
        previewCount={previewCount}
        browseResultCount={browseTotal}
        viewMode={viewMode}
        sortMode={sortMode}
        onViewModeChange={setViewMode}
        onSortModeChange={setSortMode}
        hasResults={displayResults.length > 0}
        aiResultCount={aiResults?.length ?? 0}
        searchTime={searchTime}
      />

      {aiError && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <p>{aiError}</p>
          <button
            onClick={() => runAiSearch(query)}
            className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Try again →
          </button>
        </div>
      )}

      {browseError && !isAiMode && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <p>{browseError}</p>
          <button onClick={() => setBrowseRetry(value => value + 1)} className="mt-2 text-xs font-medium text-primary hover:text-primary/80">Try again →</button>
        </div>
      )}

      {loadingResults && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border/80 bg-card">
              {/* Match TalentCard proportions: 4:3 image, title row, subtitle, skill badges */}
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingResults && displayResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {isAiMode ? <Sparkles className="size-5" /> : <SearchX className="size-5" />}
          </div>
          <p className="text-sm font-medium">
            {isAiMode ? 'No matches found. Try a different query.' : 'No talent matches those filters.'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">Adjust your search or filters to see more creative talent.</p>
        </div>
      )}

      {!loadingResults && displayResults.length > 0 && (
        <>
          {viewMode === 'swipe' && (
            <div className="pb-20">
              <SwipeStack
                results={displayResults}
                onContact={handleContact}
                onPass={handlePass}
                onViewProfile={id => router.push(`/talent/${id}`)}
              />
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 gap-4 card-stagger sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayResults.map(({ profile, match_score, match_reasons }) => (
                <TalentCard
                  key={profile.id}
                  profile={profile}
                  matchScore={isAiMode ? match_score : undefined}
                  matchReasons={isAiMode ? match_reasons : undefined}
                  href={`/talent/${profile.id}`}
                  views={talentStats[profile.id]?.views}
                  likes={talentStats[profile.id]?.likes}
                />
              ))}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-2">
              {displayResults.map(({ profile, match_score, match_reasons }) => (
                <TalentListItem
                  key={profile.id}
                  profile={profile}
                  matchScore={isAiMode ? match_score : undefined}
                  matchReasons={isAiMode ? match_reasons : undefined}
                  href={`/talent/${profile.id}`}
                  views={talentStats[profile.id]?.views}
                  likes={talentStats[profile.id]?.likes}
                />
              ))}
            </div>
          )}
        </>
      )}

      <OutreachModal
        talent={outreachTalent}
        onClose={() => setOutreachTalent(null)}
        onSent={() => setOutreachTalent(null)}
      />
    </div>
  )
}
