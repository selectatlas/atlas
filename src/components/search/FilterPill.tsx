'use client'

import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TalentFilterDefinition } from '@/lib/filter-taxonomy'
import type { SearchFilters, SearchFilterValue } from '@/lib/search-filters'
import { Button } from '@/components/ui/button'
import { FilterSection } from './FilterSection'

export function FilterPill({ definition, filters, onChange }: { definition: TalentFilterDefinition; filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [draftValue, setDraftValue] = useState<SearchFilterValue | undefined>(filters[definition.key as keyof SearchFilters])
  const active = filters[definition.key as keyof SearchFilters] !== undefined
  const draft = { ...filters, [definition.key]: draftValue }

  function syncDraft() {
    setDraftValue(filters[definition.key as keyof SearchFilters])
  }

  return (
    <details ref={detailsRef} className="group relative" onToggle={event => {
      if ((event.target as HTMLDetailsElement).open) syncDraft()
    }}>
      <summary
        className={`flex h-7 cursor-pointer list-none items-center gap-1 rounded-full border px-2.5 text-[0.8rem] font-medium outline-none transition-[transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] marker:content-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] [&::-webkit-details-marker]:hidden ${
          active
            ? 'border-transparent bg-secondary text-secondary-foreground'
            : 'border-border bg-background hover:bg-muted hover:text-foreground'
        }`}
      >
        {definition.label}
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] space-y-4 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl">
        <FilterSection definition={definition} filters={draft} onChange={next => setDraftValue(next[definition.key as keyof SearchFilters])} compact />
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => {
            const next = { ...filters }
            if (draftValue === undefined) delete next[definition.key as keyof SearchFilters]
            else next[definition.key as keyof SearchFilters] = draftValue
            onChange(next)
            detailsRef.current?.removeAttribute('open')
          }}
        >
          Show results
        </Button>
      </div>
    </details>
  )
}
