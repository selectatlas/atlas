'use client'

import { useEffect, useState } from 'react'
import { Camera, Clapperboard, Music2, RotateCcw, SlidersHorizontal, Smartphone, Users, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { filtersForCategory } from '@/lib/filter-taxonomy'
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

const CATEGORY_TABS: Array<{ value: Category | 'all'; label: string; icon: LucideIcon }> = [
  { value: 'all', label: 'All', icon: Users },
  { value: 'actor', label: 'Actors', icon: Clapperboard },
  { value: 'dancer', label: 'Dancers', icon: Music2 },
  { value: 'photographer_videographer', label: 'Photo & video', icon: Camera },
  { value: 'content_creator', label: 'Creators', icon: Smartphone },
]

export function FilterBar({ filters, onChange, resultCount, previewCount }: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  // Total talent per category, fetched once — decorative, so failures just hide the counts.
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null)
  const category = typeof filters.category === 'string' ? filters.category as Category : 'all'
  const pills = filtersForCategory(category).filter(definition => definition.pill && definition.key !== 'category').slice(0, 3)
  const count = activeFilterCount(filters)

  useEffect(() => {
    let current = true
    Promise.all(CATEGORY_TABS.map(async tab => {
      const total = await previewCount(tab.value === 'all' ? {} : { category: tab.value })
      return [tab.value, total] as const
    }))
      .then(entries => { if (current) setCategoryCounts(Object.fromEntries(entries)) })
      .catch(() => { /* silent */ })
    return () => { current = false }
  }, [previewCount])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="group" aria-label="Talent category">
          {CATEGORY_TABS.map(({ value, label, icon: Icon }) => {
            const active = category === value
            const total = categoryCounts?.[value]
            return (
              <button
                key={value}
                type="button"
                data-state={active ? 'active' : 'inactive'}
                aria-pressed={active}
                aria-label={label}
                title={label}
                onClick={() => onChange(pruneFiltersForCategory(filters, value))}
                className="group flex h-7 shrink-0 cursor-pointer items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-[color,background-color,transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-foreground active:scale-[0.97] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-[var(--duration-fast)] ease-[var(--ease-out)] group-data-[state=active]:grid-cols-[1fr]">
                  <span className="overflow-hidden whitespace-nowrap opacity-0 transition-[opacity,padding] duration-[var(--duration-fast)] ease-[var(--ease-out)] group-data-[state=active]:pl-1.5 group-data-[state=active]:opacity-100">{label}</span>
                </span>
                {total !== undefined && (
                  <span className="pl-1.5 text-[11px] tabular-nums text-muted-foreground/60 group-data-[state=active]:text-muted-foreground">{total}</span>
                )}
              </button>
            )
          })}
        </div>
        {pills.map(definition => <FilterPill key={`${definition.key}:${JSON.stringify(filters[definition.key as keyof SearchFilters])}`} definition={definition} filters={filters} onChange={onChange} />)}
        <Button type="button" variant={count > 0 ? 'secondary' : 'outline'} size="sm" className="rounded-full" onClick={() => setSheetOpen(true)}><SlidersHorizontal className="size-3.5" />All filters{count > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] tabular-nums text-primary-foreground">{count}</span>}</Button>
        {count > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}><RotateCcw className="size-3.5" />Reset</Button>}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{resultCount} {resultCount === 1 ? 'talent' : 'talents'}</span>
      </div>
      <ActiveFilterChips filters={filters} onChange={onChange} />
      {sheetOpen && <AllFiltersSheet open onOpenChange={setSheetOpen} filters={filters} onApply={onChange} previewCount={previewCount} />}
    </div>
  )
}
