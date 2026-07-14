'use client'

import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TalentFilterDefinition } from '@/lib/filter-taxonomy'
import type { SearchFilters, SearchFilterValue } from '@/lib/search-filters'
import { FilterSection } from './FilterSection'

export function FilterPill({ definition, filters, onChange }: { definition: TalentFilterDefinition; filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [draftValue, setDraftValue] = useState<SearchFilterValue | undefined>(filters[definition.key as keyof SearchFilters])
  const active = filters[definition.key as keyof SearchFilters] !== undefined
  const draft = { ...filters, [definition.key]: draftValue }

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="list-none">
        <Button render={<span />} type="button" variant={active ? 'secondary' : 'outline'} size="sm" className="cursor-pointer rounded-full">{definition.label}<ChevronDown className="size-3 transition-transform group-open:rotate-180" /></Button>
      </summary>
      <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-80 space-y-4 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl">
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
