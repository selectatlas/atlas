'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pencil, RefreshCw, SearchX, Sparkles } from 'lucide-react'
import { TalentCard, TalentListItem } from '@/components/talent/TalentCard'
import { SearchHeader } from '@/components/search/SearchHeader'
import { SearchSuggestionChips } from '@/components/search/SearchSuggestionChips'
import { PageShell } from '@/components/layout/PageShell'
import { SwipeStack } from '@/components/talent/SwipeStack'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parsedIntentChips } from '@/lib/search-intent'
import { rosterFreshnessLabel } from '@/lib/roster-freshness'
import { serializeSearchFilters, type SearchFilters } from '@/lib/search-filters'
import { BROWSE_PAGE_SIZE } from '@/lib/talent-browse'
import type { TalentLevel } from '@/lib/talent-level'
import { useSearchFilters } from '@/components/search/useSearchFilters'
import { useSearch } from '@/components/search/search-context'
import posthog from 'posthog-js'
import type { Profile, TalentSkill, TalentSearchResult } from '@/types'

type ViewMode = 'swipe' | 'grid' | 'list'
type SortMode = 'newest' | 'available'

interface SearchPageContentProps {
  /** Page-1 browse results rendered server-side, so the browser can start
   * requesting card images before any client JS has run. Empty when the
   * page loaded with a `q` param, since that's AI-search territory. */
  initialResults: TalentSearchResult[]
  initialTotal: number
  /** True when `initialResults` reflects the current default browse view
   * (no query, page 1, sort=newest) and the mount-time fetch can be skipped. */
  initialDataReady: boolean
}

export function SearchPageContent({ initialResults, initialTotal, initialDataReady }: SearchPageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { filters, setFilters } = useSearchFilters()

  const [allTalent, setAllTalent] = useState<TalentSearchResult[]>(initialResults)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [browseTotal, setBrowseTotal] = useState(initialTotal)
  const [browsePage, setBrowsePage] = useState(1)
  const [browseLoading, setBrowseLoading] = useState(!initialDataReady)
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [browseRetry, setBrowseRetry] = useState(0)
  // The server already fetched page 1 for the current filters - skip the
  // redundant client fetch on mount so cards render straight from the SSR
  // payload instead of flashing a skeleton first.
  const skipInitialFetch = useRef(initialDataReady)

  // Query, debounce, in-flight request and parsed intent all live in the
  // shared search context so the nav palette and this page are two views onto
  // one search - not two searches racing for the same AI quota.
  const {
    query, setQuery, ai, patchAi, abortAi, runAiSearch, isLocalDemo,
    publishFilters, setOpen: setSearchOpen,
  } = useSearch()
  const { results: aiResults, searching, searchTime, error: aiError, parsed: parsedIntent, roster } = ai

  const [deepSearching, setDeepSearching] = useState(false)
  const [deepStatus, setDeepStatus] = useState<string | null>(null)
  const [agentSummary, setAgentSummary] = useState<string | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [outreachTalent, setOutreachTalent] = useState<(Profile & { talent_skills: TalentSkill[] }) | null>(null)
  const [passed, setPassed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setQuery(q)
  }, [searchParams, setQuery])

  const [talentStats, setTalentStats] = useState<Record<string, { views: number; likes: number; level?: TalentLevel }>>({})
  const filterSortKey = useMemo(
    () => `${sortMode}:${serializeSearchFilters(filters).toString()}`,
    [filters, sortMode],
  )
  const prevFilterSortKey = useRef(filterSortKey)

  // The filter row is the sole owner of filters; publishing them upward lets
  // a search run from the nav palette respect what this page has applied.
  useEffect(() => {
    publishFilters(filters)
  }, [filters, publishFilters])

  useEffect(() => {
    const filtersChanged = prevFilterSortKey.current !== filterSortKey
    if (filtersChanged) {
      prevFilterSortKey.current = filterSortKey
      // Filters moved on from what the server rendered - the SSR payload no
      // longer describes this view, so the next fetch must actually run.
      skipInitialFetch.current = false
      if (browsePage !== 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination when filters change
        setBrowsePage(1)
        return
      }
    }

    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }

    const controller = new AbortController()
    const params = serializeSearchFilters(filters)
    params.set('limit', String(BROWSE_PAGE_SIZE))
    params.set('page', String(browsePage))
    params.set('sort', sortMode === 'available' ? 'available' : 'newest')
    if (browsePage === 1) setBrowseLoading(true)
    else setBrowseLoadingMore(true)
    setBrowseError(null)
    fetch(`/api/talent?${params.toString()}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(body?.error ?? `Unable to load talent (${response.status})`)
        }
        return response.json()
      })
      .then(data => {
        const results = data.results ?? []
        setAllTalent(prev => browsePage === 1 ? results : (() => {
          const seen = new Set(prev.map(row => row.profile.id))
          const merged = [...prev]
          for (const row of results) {
            if (!seen.has(row.profile.id)) merged.push(row)
          }
          return merged
        })())
        setBrowseTotal(data.total ?? 0)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setBrowseError(error instanceof Error ? error.message : 'Unable to load talent')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBrowseLoading(false)
          setBrowseLoadingMore(false)
        }
      })
    return () => controller.abort()
  }, [browseRetry, filterSortKey, browsePage, filters, sortMode])

  useEffect(() => {
    const results = aiResults ?? allTalent
    if (results.length === 0) return
    const ids = results.map(r => r.profile.id)
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))

    Promise.all(
      chunks.map(chunk =>
        fetch('/api/talent/batch-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk }),
        }).then(r => r.ok ? r.json() : { stats: {} }),
      ),
    )
      .then(responses => {
        const merged: Record<string, { views: number; likes: number; level?: TalentLevel }> = {}
        for (const data of responses) {
          Object.assign(merged, data.stats ?? {})
        }
        setTalentStats(merged)
      })
      .catch(() => { /* silent */ })
  }, [allTalent, aiResults])

  // Agentic "deep search": streams NDJSON progress events from the agent
  // loop, then swaps its curated shortlist into the normal AI results path.
  const runDeepSearch = useCallback(async () => {
    const q = query.trim()
    if (!q || deepSearching) return
    // Deep search supersedes any pending or in-flight quick search.
    abortAi()
    aiAbortRef.current?.abort()
    const controller = new AbortController()
    aiAbortRef.current = controller
    setDeepSearching(true)
    patchAi({ searching: false, error: null })
    setAgentSummary(null)
    setDeepStatus('Planning the search…')
    const t0 = Date.now()

    try {
      const res = await fetch('/api/search/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, filters }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'Deep search failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let event: { type?: string; message?: string; error?: string; summary?: string; results?: TalentSearchResult[] }
          try { event = JSON.parse(line) } catch { continue }
          if (event.type === 'status' && event.message) setDeepStatus(event.message)
          else if (event.type === 'error') throw new Error(event.error ?? 'Deep search failed')
          else if (event.type === 'results') {
            const results = event.results ?? []
            setAgentSummary(event.summary || null)
            const elapsed = Date.now() - t0
            patchAi({ results, searchTime: elapsed })
            posthog.capture('agent_search_performed', {
              result_count: results.length,
              search_time_ms: elapsed,
            })
          }
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        patchAi({ error: error instanceof Error ? error.message : 'Deep search failed' })
      }
    }
    if (aiAbortRef.current === controller) {
      setDeepSearching(false)
      setDeepStatus(null)
    }
  }, [query, filters, deepSearching, abortAi, patchAi])

  // The quick-search debounce lives in the search context. This page only
  // clears the agent summary, which belongs to the deep-search path.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a summary must not outlive the query it described
    setAgentSummary(null)
    return () => aiAbortRef.current?.abort()
  }, [query])

  const isAiMode = query.trim().length > 0
  // Browse results are already stably ordered by the filtered SQL function.
  // Keeping that order is especially important for `available`, which uses
  // the structured `available_now` field that is intentionally not public.
  const displayResults = (isAiMode ? (aiResults ?? []) : allTalent).filter(r => !passed.has(r.profile.id))
  const loadingResults = searching || deepSearching || (!isAiMode && browseLoading)
  const intentChips = parsedIntent ? parsedIntentChips(parsedIntent) : []

  const previewCount = useCallback(async (previewFilters: SearchFilters) => {
    const params = serializeSearchFilters(previewFilters)
    params.set('limit', '1')
    const response = await fetch(`/api/talent?${params.toString()}`)
    if (!response.ok) throw new Error('Unable to preview filters')
    const data = await response.json()
    return Number(data.total ?? 0)
  }, [])

  function handleContact(talent: Profile & { talent_skills: TalentSkill[] }) {
    setOutreachTalent(talent)
  }

  function handlePass(talentId: string) {
    setPassed(s => new Set([...s, talentId]))
  }

  function handleUndo(talentId: string) {
    setPassed(s => {
      const next = new Set(s)
      next.delete(talentId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageShell />
      <SearchHeader
        query={query}
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
        rosterFreshness={rosterFreshnessLabel(roster?.total, roster?.added_this_week)}
      />

      {isAiMode && !searching && !deepSearching && !agentSummary && intentChips.length > 0 && (
        <section aria-label="AI-parsed search intent" className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">AI · Understood</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {intentChips.map(chip => (
              <Badge key={chip} variant="secondary">{chip}</Badge>
            ))}
          </div>
        </section>
      )}

      {isAiMode && !isLocalDemo && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={runDeepSearch}
            disabled={deepSearching || searching}
          >
            <Sparkles className="size-3.5" />
            {deepSearching ? 'Deep searching…' : 'Deep search'}
          </Button>
          {deepSearching && deepStatus && (
            <p className="text-xs text-muted-foreground animate-pulse">{deepStatus}</p>
          )}
          {!deepSearching && !agentSummary && (
            <p className="text-xs text-muted-foreground">Let the AI agent refine, compare and shortlist for you.</p>
          )}
        </div>
      )}

      {isAiMode && agentSummary && !deepSearching && (
        <section aria-label="AI deep-search summary" className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">AI summary</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={runDeepSearch}
              disabled={deepSearching || searching}
            >
              <RefreshCw className="size-3" />
              Regenerate
            </Button>
          </div>
          <p className="mt-1.5">{agentSummary}</p>
        </section>
      )}

      {aiError && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <p>{aiError}</p>
          <Button type="button" variant="link" size="xs" className="mt-2 h-auto p-0" onClick={() => runAiSearch(query)}>
            Try again →
          </Button>
        </div>
      )}

      {browseError && !isAiMode && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <p>{browseError}</p>
          <Button type="button" variant="link" size="xs" className="mt-2 h-auto p-0" onClick={() => setBrowseRetry(value => value + 1)}>Try again →</Button>
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
          <SearchSuggestionChips
            label="Or try one of these searches"
            onSelect={setQuery}
            className="mt-5 [&>div]:justify-center"
          />
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
                onUndo={handleUndo}
                onViewProfile={id => router.push(`/talent/${id}`)}
              />
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 gap-4 card-stagger sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayResults.map(({ profile, match_score, match_reasons, badges, images }, index) => (
                <TalentCard
                  key={profile.id}
                  profile={profile}
                  matchScore={isAiMode ? match_score : undefined}
                  matchReasons={isAiMode ? match_reasons : undefined}
                  href={`/talent/${profile.id}`}
                  views={talentStats[profile.id]?.views}
                  likes={talentStats[profile.id]?.likes}
                  level={talentStats[profile.id]?.level}
                  badges={badges}
                  images={images}
                  onMessage={() => setOutreachTalent(profile)}
                  priority={index < 4}
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
                  level={talentStats[profile.id]?.level}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!isAiMode && !browseLoading && allTalent.length < browseTotal && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setBrowsePage(page => page + 1)}
            disabled={browseLoadingMore}
          >
            {browseLoadingMore ? 'Loading…' : `Load more (${allTalent.length} of ${browseTotal})`}
          </Button>
        </div>
      )}

      <OutreachModal
        talent={outreachTalent}
        onClose={() => setOutreachTalent(null)}
        onSent={() => setOutreachTalent(null)}
      />
    </div>
  )
}
