'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

export function AllFiltersSheet({ open, onOpenChange, filters, onApply, previewCount }: AllFiltersSheetProps) {
  const [draft, setDraft] = useState<SearchFilters>(filters)
  const [count, setCount] = useState<number | null>(null)

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

  return (
    <Dialog open={open} onOpenChange={next => {
      if (next) setDraft(filters)
      onOpenChange(next)
    }}>
      <DialogContent className="!inset-y-0 !left-auto !right-0 !top-0 !h-dvh !max-w-xl !translate-x-0 !translate-y-0 !grid-rows-[auto_minmax(0,1fr)_auto] !rounded-none !p-0 sm:!max-w-xl" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-5 py-4"><DialogTitle className="text-lg">All filters</DialogTitle><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {sections.map(section => (
              <section key={section} className="space-y-4 border-b border-border/70 pb-6 last:border-0">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{section}</h3>
                {definitions.filter(definition => definition.section === section).map(definition => <FilterSection key={definition.key} definition={definition} filters={draft} onChange={updateDraft} />)}
              </section>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-border bg-background p-4">
          <Button type="button" variant="outline" onClick={() => updateDraft({})}>Reset</Button>
          <Button type="button" className="flex-1" onClick={() => { onApply(draft); onOpenChange(false) }}>Show results{count !== null ? ` (${count})` : ''}</Button>
        </div>
        <span className="sr-only">{activeFilterCount(draft)} active filters</span>
      </DialogContent>
    </Dialog>
  )
}
