'use client'

import { useState } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CATEGORY_LABELS } from '@/lib/skills'
import { filtersForCategory, SEARCH_CATEGORIES } from '@/lib/filter-taxonomy'
import { activeFilterCount, pruneFiltersForCategory, type SearchFilters } from '@/lib/search-filters'
import { ActiveFilterChips } from './ActiveFilterChips'
import { AllFiltersSheet } from './AllFiltersSheet'
import { FilterPill } from './FilterPill'
import type { Category } from '@/types'

interface FilterBarProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  resultCount: number
  previewCount: (filters: SearchFilters) => Promise<number>
}

export function FilterBar({ filters, onChange, resultCount, previewCount }: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const category = typeof filters.category === 'string' ? filters.category as Category : 'all'
  const pills = filtersForCategory(category).filter(definition => definition.pill && definition.key !== 'category').slice(0, 3)
  const count = activeFilterCount(filters)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange(pruneFiltersForCategory(filters, 'all'))} className={`h-8 rounded-full border px-3 text-xs font-medium ${category === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'}`}>All</button>
        {SEARCH_CATEGORIES.map(item => <button key={item} type="button" onClick={() => onChange(pruneFiltersForCategory(filters, item))} className={`h-8 rounded-full border px-3 text-xs font-medium ${category === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}>{CATEGORY_LABELS[item]}</button>)}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        {pills.map(definition => <FilterPill key={`${definition.key}:${JSON.stringify(filters[definition.key as keyof SearchFilters])}`} definition={definition} filters={filters} onChange={onChange} />)}
        <Button type="button" variant={count > 0 ? 'secondary' : 'outline'} size="sm" className="rounded-full" onClick={() => setSheetOpen(true)}><SlidersHorizontal className="size-3.5" />All filters{count > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{count}</span>}</Button>
        {count > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}><RotateCcw className="size-3.5" />Reset</Button>}
        <span className="ml-auto text-xs text-muted-foreground">{resultCount} {resultCount === 1 ? 'talent' : 'talents'}</span>
      </div>
      <ActiveFilterChips filters={filters} onChange={onChange} />
      {sheetOpen && <AllFiltersSheet open onOpenChange={setSheetOpen} filters={filters} onApply={onChange} previewCount={previewCount} />}
    </div>
  )
}
