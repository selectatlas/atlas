'use client'

import { useRef, useEffect, useState } from 'react'
import { Grid2X2, List, MoveHorizontal, Sparkles, X } from 'lucide-react'
import { FilterBar } from '@/components/search/FilterBar'
import { SaveSearchButton } from '@/components/search/SaveSearchButton'
import { SearchSuggestionChips } from '@/components/search/SearchSuggestionChips'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { SearchFilters } from '@/lib/search-filters'

type ViewMode = 'swipe' | 'grid' | 'list'
type SortMode = 'newest' | 'available'

interface SearchHeaderProps {
  query: string
  onQueryChange: (q: string) => void
  onClearQuery: () => void
  searching: boolean
  isAiMode: boolean
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  previewCount: (filters: SearchFilters) => Promise<number>
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
  filters, onFiltersChange, previewCount,
  browseResultCount,
  viewMode, sortMode, onViewModeChange, onSortModeChange, hasResults,
  aiResultCount, searchTime,
}: SearchHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(false)
  const [stickyHeight, setStickyHeight] = useState(0)
  const [inputFocused, setInputFocused] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-112px 0px 0px 0px' }
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
          ? 'fixed inset-x-0 top-28 z-30 border-b bg-background/95 px-4 py-4 backdrop-blur-md sm:px-6 md:left-64 md:top-14 md:px-8 md:py-6 lg:px-10'
          : ''
      }`}
    >
        <div className={isSticky ? 'mx-auto max-w-[1440px] space-y-3' : 'space-y-3'}>
        {!isAiMode && (
          <div className="sr-only">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Hirer workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight">Find the right talent</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Describe the brief in your own words. Atlas will surface the people most likely to fit.</p>
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
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClearQuery}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Suggested searches: shown when the input is focused and empty */}
        {inputFocused && !query.trim() && (
          <SearchSuggestionChips onSelect={onQueryChange} className="max-w-3xl" />
        )}

        {/* AI mode: result meta */}
        {isAiMode && !searching && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-primary font-medium">{aiResultCount} AI matches</span>
            {searchTime && <span>in {searchTime}ms</span>}
            <span className="ml-auto text-muted-foreground/60">Ranked by relevance</span>
          </div>
        )}

        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <FilterBar filters={filters} onChange={onFiltersChange} resultCount={isAiMode ? aiResultCount : browseResultCount} previewCount={previewCount} />
          </div>
          <SaveSearchButton query={query} filters={filters} />
        </div>

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
                  <option value="newest">Newest</option>
                  <option value="available">Available first</option>
                </select>
              )}
              <div className="flex gap-0.5 rounded-lg bg-muted p-1" role="group" aria-label="View mode">
                {(['grid', 'list', 'swipe'] as ViewMode[]).map(mode => (
                  (() => {
                    const Icon = mode === 'swipe' ? MoveHorizontal : mode === 'grid' ? Grid2X2 : List
                    return (
                  <Button
                    type="button"
                    key={mode}
                    size="xs"
                    variant={viewMode === mode ? 'secondary' : 'ghost'}
                    onClick={() => onViewModeChange(mode)}
                    aria-label={`${mode} view`}
                    aria-pressed={viewMode === mode}
                    className={viewMode === mode ? 'bg-background text-foreground shadow-sm' : ''}
                  >
                    <Icon className="size-3.5" />
                    <span className="hidden sm:inline">{mode}</span>
                  </Button>
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
