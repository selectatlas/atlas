'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicTalentCard } from '@/components/talent/PublicTalentCard'
import { useSearch } from '@/components/search/search-context'
import { CATEGORY_LABELS } from '@/lib/skills'
import type { PublicTalentPage, PublicTalentRow } from '@/lib/talent-discovery'
import type { Category } from '@/types'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

interface PublicTalentExplorerProps {
  /** Default first page, server-rendered at build/revalidate time. */
  initialPage: PublicTalentPage
}

// Interactive layer over the ISR shell: category chips + search + load-more,
// fetching live data from the public API. Mirrors PublicJobsExplorer,
// including the deliberate avoidance of useSearchParams() (it would bail the
// static tree to client rendering and strip the cards from the prerendered
// HTML) - deep-linked filters are read from window.location after hydration.
export function PublicTalentExplorer({ initialPage }: PublicTalentExplorerProps) {
  const router = useRouter()
  const [category, setCategory] = useState<Category | null>(null)
  const [search, setSearch] = useState('')
  const [talent, setTalent] = useState<PublicTalentRow[]>(initialPage.talent)
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor)
  const [total, setTotal] = useState<number | null>(initialPage.total)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  // Full profiles are the gated tier: anonymous visitors get sent through
  // signup (hirer preselected, profile as the return task); signed-in
  // viewers link straight through. Static render assumes anon; a session
  // check corrects it after hydration - same pattern as AuthAwareApplyCta.
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session) setSignedIn(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const fetchPage = useCallback(
    async (opts: { category: Category | null; search: string; cursor: string | null }) => {
      const params = new URLSearchParams()
      if (opts.category) params.set('category', opts.category)
      if (opts.search) params.set('q', opts.search)
      if (opts.cursor) params.set('cursor', opts.cursor)
      const res = await fetch(`/api/talent/public?${params.toString()}`)
      if (!res.ok) throw new Error('fetch failed')
      return (await res.json()) as PublicTalentPage
    },
    []
  )

  const runFilteredFetch = useCallback(
    (nextCategory: Category | null, nextSearch: string) => {
      let cancelled = false
      setLoading(true)
      setError(false)
      fetchPage({ category: nextCategory, search: nextSearch, cursor: null })
        .then(page => {
          if (cancelled) return
          setTalent(page.talent)
          setNextCursor(page.nextCursor)
          setTotal(page.total)
        })
        .catch(() => {
          if (!cancelled) setError(true)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    },
    [fetchPage]
  )

  // Apply deep-linked filters (shared/bookmarked URLs) once after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkedCategory = params.get('category')
    const linkedSearch = params.get('q') ?? ''
    const validCategory = CATEGORIES.includes(linkedCategory as Category) ? (linkedCategory as Category) : null
    if (!validCategory && !linkedSearch) return
    // The hydrate-then-apply re-render is deliberate: deep-linked filters are
    // only knowable client-side (useSearchParams would bail the static HTML).
    /* eslint-disable react-hooks/set-state-in-effect */
    setCategory(validCategory)
    setSearch(linkedSearch)
    return runFilteredFetch(validCategory, linkedSearch)
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The nav search surface is the only query input. A commit there must reach
  // this list even when it does not change the route - navigating to the page
  // we are already on will not remount, so the URL alone cannot signal it.
  const { committed } = useSearch()
  const lastCommitRef = useRef(committed.nonce)
  useEffect(() => {
    if (committed.nonce === lastCommitRef.current) return
    lastCommitRef.current = committed.nonce
    applyFilters(category, committed.query)
    // applyFilters is stable for this purpose: it only reads props/state it
    // is given explicitly, and re-running on identity churn would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed.nonce, committed.query])

  function applyFilters(nextCategory: Category | null, nextSearch: string) {
    setCategory(nextCategory)
    setSearch(nextSearch)
    const params = new URLSearchParams()
    if (nextCategory) params.set('category', nextCategory)
    if (nextSearch) params.set('q', nextSearch)
    const query = params.toString()
    router.replace(query ? `/talent?${query}` : '/talent', { scroll: false })
    runFilteredFetch(nextCategory, nextSearch)
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchPage({ category, search, cursor: nextCursor })
      setTalent(current => [...current, ...page.talent])
      setNextCursor(page.nextCursor)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  function profileHref(id: string) {
    if (signedIn) return `/talent/${id}`
    return `/signup?next=${encodeURIComponent(`/talent/${id}`)}&as=hirer`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <FilterChip label="All" active={category === null} onClick={() => applyFilters(null, search)} />
        {CATEGORIES.map(value => (
          <FilterChip
            key={value}
            label={CATEGORY_LABELS[value]}
            active={category === value}
            onClick={() => applyFilters(value, search)}
          />
        ))}
      </div>

      {total !== null && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total} {total === 1 ? 'profile' : 'profiles'}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Talent could not be loaded. Please try again.
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : talent.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="font-medium">No talent matches those filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different category or clear your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {talent.map(person => (
            <PublicTalentCard
              key={person.id}
              talent={person}
              href={profileHref(person.id)}
              cta={signedIn ? 'View full profile' : 'Sign up to view profile'}
            />
          ))}
        </div>
      )}

      {nextCursor && !loading && (
        <div className="flex justify-center pt-2">
          <Button onClick={loadMore} disabled={loadingMore} variant="outline" className="rounded-xl">
            {loadingMore ? 'Loading...' : 'Load more talent'}
          </Button>
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="xs"
      variant={active ? 'default' : 'outline'}
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full px-3"
    >
      {label}
    </Button>
  )
}
