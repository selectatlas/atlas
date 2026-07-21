'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'
import { isActiveLocalDemoMode } from '@/lib/demo-mode'
import { searchDemoTalent } from '@/lib/demo-data'
import {
  canUseScope,
  resolveScope,
  type SearchAudience,
  type SearchScope,
} from '@/lib/search-scope'
import type { SearchFilters } from '@/lib/search-filters'
import type { ParsedQuery } from '@/lib/openai'
import type { TalentSearchResult } from '@/types'

// Shared state for the single app-wide search box.
//
// The nav palette and the results page are two views onto ONE query. If they
// each kept their own state they would also each keep their own debounce
// timer and abort controller, and every keystroke would spend two calls
// against a 20-per-60s AI quota. Everything that costs money - the debounce,
// the in-flight request, the parsed intent - lives here exactly once.

/** Minimum characters before an AI search is worth spending quota on. */
export const MIN_AI_QUERY_LENGTH = 3

/** Debounce before an AI search fires. Tuned against the 20/60s quota. */
export const AI_SEARCH_DEBOUNCE_MS = 400

export type AiSearchState = {
  results: TalentSearchResult[] | null
  searching: boolean
  searchTime: number | null
  error: string | null
  parsed: ParsedQuery | null
  roster: { total: number | null; added_this_week: number | null } | null
}

/** A keyword hit, reduced to what the palette actually renders. */
export type KeywordMatch = {
  id: string
  name: string
  detail: string | null
}

export type KeywordFallbackState = {
  results: KeywordMatch[]
  loading: boolean
  /** The query the fallback ran for, so stale hits never render. */
  forQuery: string | null
}

const EMPTY_FALLBACK: KeywordFallbackState = { results: [], loading: false, forQuery: null }

/** A result row from any non-talent-AI scope, reduced to what renders. */
export type ResultHit = {
  id: string
  title: string
  subtitle: string | null
  href: string
}

/** Jobs scope, and the keyword-only public talent/jobs scopes. */
export type ScopedSearchState = {
  hits: ResultHit[]
  loading: boolean
  chips: string[]
  error: string | null
  forQuery: string | null
}

const EMPTY_SCOPED: ScopedSearchState = {
  hits: [], loading: false, chips: [], error: null, forQuery: null,
}

export type GlobalGroup = {
  category: string
  label: string
  hits: ResultHit[]
}

export type GlobalSearchState = {
  groups: GlobalGroup[]
  loading: boolean
  forQuery: string | null
}

const EMPTY_GLOBAL: GlobalSearchState = { groups: [], loading: false, forQuery: null }

/**
 * Which pipeline this scope+audience actually runs. Everything downstream -
 * the debounce, the endpoint, what the palette renders - keys off this, so
 * there is exactly one place that decides what a given box does.
 */
export type SearchMode =
  | 'talent-ai'      // hirer on Talent: gpt-4o-mini + embeddings
  | 'jobs-ai'        // talent account on Jobs: gpt-4o-mini intent parse
  | 'global'         // signed-in, anywhere else: multi-surface router
  | 'public-talent'  // signed out on /talent: keyword only
  | 'public-jobs'    // signed out on /jobs: keyword only
  | 'none'           // nothing to run; navigation only

export function resolveSearchMode(scope: SearchScope, audience: SearchAudience): SearchMode {
  if (audience === 'public') {
    if (scope === 'talent') return 'public-talent'
    if (scope === 'jobs') return 'public-jobs'
    return 'none'
  }
  if (scope === 'talent') return audience === 'hirer' ? 'talent-ai' : 'none'
  if (scope === 'jobs') return audience === 'talent' ? 'jobs-ai' : 'none'
  return 'global'
}

const EMPTY_AI: AiSearchState = {
  results: null,
  searching: false,
  searchTime: null,
  error: null,
  parsed: null,
  roster: null,
}

type SearchContextValue = {
  audience: SearchAudience
  /** Scope in effect: the user's override if they set one, else the route's. */
  scope: SearchScope
  /** Scope implied by the route alone, ignoring any override. */
  routeScope: SearchScope
  setScope: (scope: SearchScope | null) => void

  open: boolean
  setOpen: (open: boolean) => void

  query: string
  setQuery: (query: string) => void

  /**
   * The last *committed* query - what the user pressed Enter on, not what they
   * have typed. Surfaces that own their own data (the public explorers) apply
   * this rather than the live query, so they refetch once on commit instead of
   * once per keystroke. `nonce` makes a repeat of the same query observable.
   */
  committed: { query: string; nonce: number }
  commitSearch: (query: string) => void

  /**
   * Filters the results page currently has applied, published upward so a
   * search run from the palette respects the page's filter row. The palette
   * never writes these - the filter row stays the sole owner.
   */
  filters: SearchFilters
  publishFilters: (filters: SearchFilters) => void

  /** True when this scope+audience actually runs the AI pipeline. */
  canRunAi: boolean

  /** Which pipeline this box runs. */
  mode: SearchMode

  /** Results for the jobs and public keyword scopes. */
  scoped: ScopedSearchState

  /** Grouped results for the global router. */
  global: GlobalSearchState

  /**
   * Plain keyword matches, run only when the AI path returns nothing. This is
   * the escape hatch for a query the parser could not turn into structured
   * intent - a stage name, a spelling it does not know - so the box never
   * dead-ends on "no matches".
   */
  fallback: KeywordFallbackState

  ai: AiSearchState
  patchAi: (patch: Partial<AiSearchState>) => void
  abortAi: () => void
  runAiSearch: (query: string) => Promise<void>

  isLocalDemo: boolean
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({
  audience,
  children,
}: {
  audience: SearchAudience
  children: ReactNode
}) {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // The override records which route scope it was chosen against, so leaving
  // that surface drops it without needing an effect to reset state.
  const [scopeOverride, setScopeOverride] = useState<
    { scope: SearchScope; forRoute: SearchScope } | null
  >(null)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [ai, setAi] = useState<AiSearchState>(EMPTY_AI)
  const [fallback, setFallback] = useState<KeywordFallbackState>(EMPTY_FALLBACK)
  const [scoped, setScoped] = useState<ScopedSearchState>(EMPTY_SCOPED)
  const [committed, setCommitted] = useState({ query: '', nonce: 0 })
  const [globalState, setGlobalState] = useState<GlobalSearchState>(EMPTY_GLOBAL)
  const [isLocalDemo, setIsLocalDemo] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackAbortRef = useRef<AbortController | null>(null)
  const scopedAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    void isActiveLocalDemoMode().then(setIsLocalDemo)
  }, [])

  const routeScope = useMemo(
    () => resolveScope(pathname ?? '/', audience),
    [pathname, audience],
  )

  // An override survives only while the user is still on the surface it was
  // set against, and only while it is legal for this audience.
  const scope =
    scopeOverride &&
    scopeOverride.forRoute === routeScope &&
    canUseScope(scopeOverride.scope, audience)
      ? scopeOverride.scope
      : routeScope

  const setScope = useCallback(
    (next: SearchScope | null) => {
      setScopeOverride(next ? { scope: next, forRoute: routeScope } : null)
    },
    [routeScope],
  )

  const patchAi = useCallback((patch: Partial<AiSearchState>) => {
    setAi(current => ({ ...current, ...patch }))
  }, [])

  const abortAi = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    fallbackAbortRef.current?.abort()
    fallbackAbortRef.current = null
    scopedAbortRef.current?.abort()
    scopedAbortRef.current = null
    setFallback(EMPTY_FALLBACK)
    setScoped(EMPTY_SCOPED)
    setGlobalState(EMPTY_GLOBAL)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const publishFilters = useCallback((next: SearchFilters) => {
    setFilters(next)
  }, [])

  const commitSearch = useCallback((next: string) => {
    setCommitted(current => ({ query: next.trim(), nonce: current.nonce + 1 }))
  }, [])

  // Plain substring match against the public talent view (name, headline,
  // location, skills). Unauthenticated and cheap - no LLM, no embedding - so
  // it is safe to run for any audience the moment the AI path comes back dry.
  const runKeywordFallback = useCallback(async (raw: string) => {
    const q = raw.trim()
    fallbackAbortRef.current?.abort()
    if (q.length < MIN_AI_QUERY_LENGTH) {
      setFallback(EMPTY_FALLBACK)
      return
    }

    const controller = new AbortController()
    fallbackAbortRef.current = controller
    setFallback({ results: [], loading: true, forQuery: q })

    try {
      const response = await fetch(
        `/api/talent/public?q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
      if (!response.ok) throw new Error('fallback failed')
      const data = await response.json()
      const rows: Array<{ id: string; full_name: string; headline: string | null; city: string | null }> =
        data.talent ?? []
      setFallback({
        results: rows.slice(0, 5).map(row => ({
          id: row.id,
          name: row.full_name,
          detail: row.headline ?? row.city ?? null,
        })),
        loading: false,
        forQuery: q,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      // A failed fallback is not worth surfacing: the AI result (or its
      // error) is already on screen and remains the primary signal.
      setFallback({ results: [], loading: false, forQuery: q })
    } finally {
      if (fallbackAbortRef.current === controller) fallbackAbortRef.current = null
    }
  }, [])

  const runAiSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim()
      abortRef.current?.abort()

      if (q.length < MIN_AI_QUERY_LENGTH) {
        abortRef.current = null
        setAi(EMPTY_AI)
        setFallback(EMPTY_FALLBACK)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      setAi(current => ({ ...current, searching: true, error: null }))
      const startedAt = Date.now()

      // The seeded demo world answers locally so a rehearsed walkthrough never
      // depends on the OpenAI round trip.
      if (isLocalDemo) {
        const demoResults = searchDemoTalent(q, filters)
        setAi({ ...EMPTY_AI, results: demoResults, searchTime: Date.now() - startedAt })
        if (demoResults.length === 0) void runKeywordFallback(q)
        else setFallback(EMPTY_FALLBACK)
        abortRef.current = null
        return
      }

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, filters }),
          signal: controller.signal,
        })
        const data = await response.json()

        if (data.error) {
          setAi({ ...EMPTY_AI, error: data.error })
        } else {
          const results: TalentSearchResult[] = data.results ?? []
          const elapsed = Date.now() - startedAt
          setAi({
            results,
            searching: false,
            searchTime: elapsed,
            error: null,
            parsed: (data.parsed as ParsedQuery | undefined) ?? null,
            roster: data.roster ?? null,
          })
          posthog.capture('ai_search_performed', {
            result_count: results.length,
            search_time_ms: elapsed,
          })
          // The parser produced nothing usable for this query - fall back to
          // plain keyword matching rather than dead-ending the user.
          if (results.length === 0) void runKeywordFallback(q)
          else setFallback(EMPTY_FALLBACK)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setAi({ ...EMPTY_AI, error: 'Search failed' })
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [filters, isLocalDemo, runKeywordFallback],
  )

  // Jobs scope (signed-in talent): natural-language job search. Same shape as
  // the talent pipeline - parse, then answer from the discover feed.
  const runJobSearch = useCallback(async (raw: string) => {
    const q = raw.trim()
    scopedAbortRef.current?.abort()
    const controller = new AbortController()
    scopedAbortRef.current = controller
    setScoped({ ...EMPTY_SCOPED, loading: true, forQuery: q })

    try {
      const response = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        setScoped({ ...EMPTY_SCOPED, error: data.error ?? 'Search failed', forQuery: q })
        return
      }
      setScoped({
        hits: (data.jobs ?? []).map((job: { id: string; title: string; location: string | null }) => ({
          id: job.id,
          title: job.title,
          subtitle: job.location,
          href: `/discover/${job.id}`,
        })),
        loading: false,
        chips: data.chips ?? [],
        error: null,
        forQuery: q,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setScoped({ ...EMPTY_SCOPED, error: 'Search failed', forQuery: q })
    } finally {
      if (scopedAbortRef.current === controller) scopedAbortRef.current = null
    }
  }, [])

  // Signed-out marketplace scopes: keyword only, against the anon endpoints.
  // No LLM is reachable here by design - see the note on canRunAi.
  const runPublicSearch = useCallback(async (raw: string, kind: 'talent' | 'jobs') => {
    const q = raw.trim()
    scopedAbortRef.current?.abort()
    const controller = new AbortController()
    scopedAbortRef.current = controller
    setScoped({ ...EMPTY_SCOPED, loading: true, forQuery: q })

    const url = kind === 'talent'
      ? `/api/talent/public?q=${encodeURIComponent(q)}`
      : `/api/jobs/public?q=${encodeURIComponent(q)}`

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error('search failed')
      const data = await response.json()
      const hits: ResultHit[] = kind === 'talent'
        ? (data.talent ?? []).map((row: { id: string; full_name: string; headline: string | null; city: string | null }) => ({
            id: row.id,
            title: row.full_name,
            subtitle: row.headline ?? row.city,
            href: `/talent/${row.id}`,
          }))
        : (data.jobs ?? []).map((row: { id: string; title: string; location: string | null }) => ({
            id: row.id,
            title: row.title,
            subtitle: row.location,
            href: `/jobs/${row.id}`,
          }))
      setScoped({ hits: hits.slice(0, 6), loading: false, chips: [], error: null, forQuery: q })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setScoped({ ...EMPTY_SCOPED, error: 'Search failed', forQuery: q })
    } finally {
      if (scopedAbortRef.current === controller) scopedAbortRef.current = null
    }
  }, [])

  // Global scope: one query routed across talent, jobs, messages and settings.
  const runGlobalSearch = useCallback(async (raw: string) => {
    const q = raw.trim()
    scopedAbortRef.current?.abort()
    const controller = new AbortController()
    scopedAbortRef.current = controller
    setGlobalState({ groups: [], loading: true, forQuery: q })

    try {
      const response = await fetch('/api/search/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('search failed')
      const data = await response.json()
      setGlobalState({ groups: data.groups ?? [], loading: false, forQuery: q })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setGlobalState({ groups: [], loading: false, forQuery: q })
    } finally {
      if (scopedAbortRef.current === controller) scopedAbortRef.current = null
    }
  }, [])

  // The single debounce. Only hirers in talent scope spend AI quota: the
  // pipeline behind /api/search is hirer-gated and per-user quota'd, so
  // firing it for a signed-out visitor would only ever return 401. Public
  // and jobs-scope searching land in phase 3 on the keyword endpoints.
  const mode = resolveSearchMode(scope, audience)
  const canRunAi = mode === 'talent-ai'

  useEffect(() => {
    if (mode === 'none') return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < MIN_AI_QUERY_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- results must not outlive the query that produced them
      setAi(EMPTY_AI)
      // Stale hits must not linger under a cleared query either.
      setFallback(EMPTY_FALLBACK)
      setScoped(EMPTY_SCOPED)
      setGlobalState(EMPTY_GLOBAL)
      return
    }

    // A stale parse must not sit under a query the user has already changed.
    if (mode === 'talent-ai') setAi(current => ({ ...current, parsed: null }))

    debounceRef.current = setTimeout(() => {
      if (mode === 'talent-ai') void runAiSearch(query)
      else if (mode === 'jobs-ai') void runJobSearch(query)
      else if (mode === 'global') void runGlobalSearch(query)
      else if (mode === 'public-talent') void runPublicSearch(query, 'talent')
      else if (mode === 'public-jobs') void runPublicSearch(query, 'jobs')
    }, AI_SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, mode, runAiSearch, runJobSearch, runGlobalSearch, runPublicSearch])

  // Abort any flight on unmount so a closing shell does not leak a request.
  useEffect(() => () => {
    abortRef.current?.abort()
    fallbackAbortRef.current?.abort()
    scopedAbortRef.current?.abort()
  }, [])

  const value = useMemo<SearchContextValue>(
    () => ({
      audience,
      scope,
      routeScope,
      setScope,
      open,
      setOpen,
      query,
      setQuery,
      committed,
      commitSearch,
      filters,
      publishFilters,
      canRunAi,
      mode,
      scoped,
      global: globalState,
      fallback,
      ai,
      patchAi,
      abortAi,
      runAiSearch,
      isLocalDemo,
    }),
    [
      audience, scope, routeScope, setScope, open, query, committed, commitSearch,
      filters, publishFilters,
      canRunAi, mode, scoped, globalState, fallback, ai, patchAi, abortAi,
      runAiSearch, isLocalDemo,
    ],
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch must be used within SearchProvider')
  return ctx
}
