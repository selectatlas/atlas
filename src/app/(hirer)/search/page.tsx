'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SearchX, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TalentCard, TalentListItem } from '@/components/talent/TalentCard'
import { SearchHeader } from '@/components/search/SearchHeader'
import { SwipeStack } from '@/components/talent/SwipeStack'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { Skeleton } from '@/components/ui/skeleton'
import { DEMO_TALENT_RESULTS, searchDemoTalent } from '@/lib/demo-data'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import type { Profile, TalentSkill, Category, TalentSearchResult } from '@/types'

type ViewMode = 'swipe' | 'grid' | 'list'
type SortMode = 'relevance' | 'newest' | 'available'

export default function SearchPage() {
  const router = useRouter()

  const [allTalent, setAllTalent] = useState<TalentSearchResult[]>([])
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [location, setLocation] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [hasShowreelOnly, setHasShowreelOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('relevance')

  const [query, setQuery] = useState('')
  const [aiResults, setAiResults] = useState<TalentSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setAllTalent(DEMO_TALENT_RESULTS.map(profile => ({ profile, match_score: 0 })))
      return
    }

    const supabase = createClient()
    supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_WITH_SKILLS)
      .eq('account_type', 'talent')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const results = (data ?? []).map(p => ({ profile: p as Profile & { talent_skills: TalentSkill[] }, match_score: 0 }))
        setAllTalent(results)
      })
  }, [])

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
    if (!q.trim()) { setAiResults(null); setSearchTime(null); return }
    setSearching(true)
    setAiError(null)
    const t0 = Date.now()

    if (isLocalDemo) {
      setAiResults(searchDemoTalent(q))
      setSearchTime(Date.now() - t0)
      setSearching(false)
      return
    }

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (data.error) { setAiError(data.error) }
      else {
        setAiResults(data.results ?? [])
        setSearchTime(Date.now() - t0)
      }
    } catch {
      setAiError('Search failed')
    }
    setSearching(false)
  }, [isLocalDemo])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!query.trim()) { setAiResults(null); setSearchTime(null); return }
    debounceRef.current = setTimeout(() => runAiSearch(query), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, runAiSearch])

  const browseResults = allTalent.filter(({ profile }) => {
    if (category !== 'all' && !profile.talent_skills.some(s => s.category === category)) return false
    if (location.trim()) {
      const q = location.toLowerCase()
      if (!profile.city?.toLowerCase().includes(q) && !profile.country?.toLowerCase().includes(q)) return false
    }
    if (availableOnly && !profile.availability) return false
    if (hasShowreelOnly && !profile.showreel_url) return false
    return true
  })

  const sortedBrowseResults = [...browseResults].sort((a, b) => {
    if (sortMode === 'newest') {
      return new Date(b.profile.created_at).getTime() - new Date(a.profile.created_at).getTime()
    }
    if (sortMode === 'available') {
      const aHas = a.profile.availability ? 1 : 0
      const bHas = b.profile.availability ? 1 : 0
      return bHas - aHas
    }
    return 0
  })

  const isAiMode = query.trim().length > 0
  const displayResults = (isAiMode ? (aiResults ?? []) : sortedBrowseResults).filter(r => !passed.has(r.profile.id))

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
        category={category}
        location={location}
        availableOnly={availableOnly}
        hasShowreelOnly={hasShowreelOnly}
        onCategoryChange={setCategory}
        onLocationChange={setLocation}
        onAvailableOnlyChange={setAvailableOnly}
        onHasShowreelOnlyChange={setHasShowreelOnly}
        browseResultCount={browseResults.length}
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

      {searching && (
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

      {!searching && displayResults.length === 0 && (
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

      {!searching && displayResults.length > 0 && (
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
