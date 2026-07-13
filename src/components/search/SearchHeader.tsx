'use client'

import { useRef, useEffect, useState } from 'react'
import { Grid2X2, List, MoveHorizontal, Sparkles, X } from 'lucide-react'
import type { Category } from '@/types'
import { FilterPanel } from '@/components/search/FilterPanel'
import { Input } from '@/components/ui/input'

type ViewMode = 'swipe' | 'grid' | 'list'
type SortMode = 'relevance' | 'newest' | 'available'

interface SearchHeaderProps {
  query: string
  onQueryChange: (q: string) => void
  onClearQuery: () => void
  searching: boolean
  isAiMode: boolean
  category: Category | 'all'
  location: string
  availableOnly: boolean
  hasShowreelOnly: boolean
  onCategoryChange: (c: Category | 'all') => void
  onLocationChange: (l: string) => void
  onAvailableOnlyChange: (v: boolean) => void
  onHasShowreelOnlyChange: (v: boolean) => void
  browseResultCount: number
  viewMode: ViewMode
  sortMode: SortMode
  onViewModeChange: (m: ViewMode) => void
  onSortModeChange: (m: SortMode) => void
  hasResults: boolean
  aiResultCount: number
  searchTime: number | null
}

export function SearchHeader({
  query, onQueryChange, onClearQuery, searching, isAiMode,
  category, location, availableOnly, hasShowreelOnly,
  onCategoryChange, onLocationChange, onAvailableOnlyChange, onHasShowreelOnlyChange,
  browseResultCount,
  viewMode, sortMode, onViewModeChange, onSortModeChange, hasResults,
  aiResultCount, searchTime,
}: SearchHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(false)
  const [stickyHeight, setStickyHeight] = useState(0)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-56px 0px 0px 0px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isSticky && headerRef.current) {
      setStickyHeight(headerRef.current.offsetHeight)
    }
  }, [isSticky])

  const controls = (
    <div
      ref={headerRef}
      className={`space-y-3 ${
        isSticky
          ? 'fixed inset-x-0 top-14 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur-md md:left-64 md:top-0'
          : ''
      }`}
    >
        <div className={isSticky ? 'mx-auto max-w-[1440px] space-y-3' : 'space-y-3'}>
        {!isAiMode && (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Hirer workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Find the right talent</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">Describe the brief in your own words. Atlas will surface the people most likely to fit.</p>
            </div>
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">AI-assisted discovery</span>
          </div>
        )}

        {/* AI Search bar */}
        <div className="relative max-w-3xl">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            {searching ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="size-4 text-primary" strokeWidth={2.2} />
            )}
          </div>
          <Input
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder='Try "Bollywood dancers in London, available December"'
            aria-label="Search talent with AI"
            className="h-12 rounded-xl border-primary/20 bg-card pl-10 pr-10 text-sm shadow-sm focus-visible:border-primary focus-visible:ring-primary/30"
          />
          {query && (
            <button
              type="button"
              onClick={onClearQuery}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {!isAiMode && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Try a brief:</span>
            {[
              'Bollywood dancers in London',
              'Hindi-speaking talent available in December',
              'Content creators for a food campaign',
            ].map(example => (
              <button
                type="button"
                key={example}
                onClick={() => onQueryChange(example)}
                className="rounded-full border border-border bg-card px-2.5 py-1.5 text-muted-foreground transition-[border-color,background-color,color] duration-[var(--duration-fast)] hover:border-primary/35 hover:bg-secondary/50 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {/* AI mode: result meta */}
        {isAiMode && !searching && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-primary font-medium">{aiResultCount} AI matches</span>
            {searchTime && <span>in {searchTime}ms</span>}
            <span className="ml-auto text-muted-foreground/60">Ranked by relevance</span>
          </div>
        )}

        {/* Browse mode: filters */}
        {!isAiMode && (
          <FilterPanel
            category={category}
            location={location}
            onCategoryChange={onCategoryChange}
            onLocationChange={onLocationChange}
            resultCount={browseResultCount}
            availableOnly={availableOnly}
            onAvailableOnlyChange={onAvailableOnlyChange}
            hasShowreelOnly={hasShowreelOnly}
            onHasShowreelOnlyChange={onHasShowreelOnlyChange}
          />
        )}

        {/* View toggle + Sort */}
        {hasResults && (
          <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {isAiMode ? 'AI results' : 'Browse'}
            </span>
            <div className="flex items-center gap-2">
              {!isAiMode && (
                <select
                  aria-label="Sort talent"
                  value={sortMode}
                  onChange={e => onSortModeChange(e.target.value as SortMode)}
                  className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="available">Available first</option>
                </select>
              )}
              <div className="flex gap-0.5 rounded-lg bg-muted p-1" role="group" aria-label="View mode">
                {(['grid', 'list', 'swipe'] as ViewMode[]).map(mode => (
                  (() => {
                    const Icon = mode === 'swipe' ? MoveHorizontal : mode === 'grid' ? Grid2X2 : List
                    return (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => onViewModeChange(mode)}
                    aria-label={`${mode} view`}
                    aria-pressed={viewMode === mode}
                    className={`flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] ${
                      viewMode === mode
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span className="hidden sm:inline">{mode}</span>
                  </button>
                    )
                  })()
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div ref={sentinelRef} className="h-0" />
      {controls}
      {isSticky && <div style={{ height: stickyHeight }} />}
    </>
  )
}
