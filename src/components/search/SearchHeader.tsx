'use client'

import { useRef, useEffect, useState } from 'react'
import { Grid2X2, List, MoveHorizontal } from 'lucide-react'
import { FilterBar } from '@/components/search/FilterBar'
import { SaveSearchButton } from '@/components/search/SaveSearchButton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SearchFilters } from '@/lib/search-filters'

type ViewMode = 'swipe' | 'grid' | 'list'
type SortMode = 'newest' | 'available'

const SORT_OPTIONS: Record<SortMode, string> = {
  newest: 'Newest',
  available: 'Available first',
}

// The query input lives in the nav search surface (SearchCommand), not here.
// This header owns only the structured controls - filters, save, view and
// sort - plus the result meta line describing the current AI result set.
interface SearchHeaderProps {
  query: string
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
  /** Computed roster provenance, e.g. "from 2,400 profiles · 34 added this week". */
  rosterFreshness?: string | null
}

export function SearchHeader({
  query, searching, isAiMode,
  filters, onFiltersChange, previewCount,
  browseResultCount,
  viewMode, sortMode, onViewModeChange, onSortModeChange, hasResults,
  aiResultCount, searchTime, rosterFreshness,
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

        {/* AI mode: result meta */}
        {isAiMode && !searching && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-primary font-medium">{aiResultCount} AI matches</span>
            {searchTime && <span>in {searchTime}ms</span>}
            {rosterFreshness && <span className="hidden sm:inline">{rosterFreshness}</span>}
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
                <Select
                  items={SORT_OPTIONS}
                  value={sortMode}
                  onValueChange={value => onSortModeChange((value ?? 'newest') as SortMode)}
                >
                  <SelectTrigger aria-label="Sort talent" className="bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
