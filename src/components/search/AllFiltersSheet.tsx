'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { filtersForCategory } from '@/lib/filter-taxonomy'
import { activeFilterCount, pruneFiltersForCategory, type SearchFilters } from '@/lib/search-filters'
import { FilterSection } from './FilterSection'
import type { Category } from '@/types'

interface AllFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: SearchFilters
  onApply: (filters: SearchFilters) => void
  previewCount: (filters: SearchFilters) => Promise<number>
}

const ALWAYS_OPEN_SECTIONS = new Set(['Category', 'Location', 'Availability'])

export function AllFiltersSheet({ open, onOpenChange, filters, onApply, previewCount }: AllFiltersSheetProps) {
  const [draft, setDraft] = useState<SearchFilters>(filters)
  const [count, setCount] = useState<number | null>(null)
  // Explicit user toggles win; otherwise sections open when primary or holding an active filter.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    let current = true
    const timer = setTimeout(() => {
      previewCount(draft)
        .then(value => { if (current) setCount(value) })
        .catch(() => { if (current) setCount(null) })
    }, 250)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [draft, open, previewCount])

  const category = typeof draft.category === 'string' ? draft.category as Category : 'all'
  const definitions = filtersForCategory(category)
  const sections = [...new Set(definitions.map(definition => definition.section))]

  function updateDraft(next: SearchFilters) {
    const nextCategory = typeof next.category === 'string' ? next.category as Category : 'all'
    setCount(null)
    setDraft(nextCategory === category ? next : pruneFiltersForCategory(next, nextCategory))
  }

  function sectionActiveCount(section: string) {
    return definitions.filter(definition => definition.section === section && draft[definition.key as keyof SearchFilters] !== undefined).length
  }

  return (
    <Sheet open={open} onOpenChange={next => {
      if (next) setDraft(filters)
      onOpenChange(next)
    }}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl" showCloseButton={false}>
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-5 py-4"><SheetTitle className="text-lg">All filters</SheetTitle><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {sections.map(section => {
              const active = sectionActiveCount(section)
              const isOpen = openSections[section] ?? (ALWAYS_OPEN_SECTIONS.has(section) || active > 0)
              return (
                <Collapsible
                  key={section}
                  open={isOpen}
                  onOpenChange={next => setOpenSections(current => ({ ...current, [section]: next }))}
                  className="border-b border-border/70 pb-4 last:border-0"
                >
                  <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1.5 text-left">
                    <span className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">{section}</h3>
                      {active > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] tabular-nums text-primary-foreground">{active}</span>}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform duration-200 group-data-panel-open:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
                    <div className="space-y-4 pt-3">
                      {definitions.filter(definition => definition.section === section).map(definition => <FilterSection key={definition.key} definition={definition} filters={draft} onChange={updateDraft} />)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </div>
        <SheetFooter className="flex-row items-center gap-3 border-t border-border bg-background p-4">
          <Button type="button" variant="outline" onClick={() => updateDraft({})}>Reset</Button>
          <Button type="button" className="flex-1 tabular-nums" onClick={() => { onApply(draft); onOpenChange(false) }}>Show results{count !== null ? ` (${count})` : ''}</Button>
        </SheetFooter>
        <span className="sr-only">{activeFilterCount(draft)} active filters</span>
      </SheetContent>
    </Sheet>
  )
}
