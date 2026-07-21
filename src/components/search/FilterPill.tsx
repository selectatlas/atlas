'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TalentFilterDefinition } from '@/lib/filter-taxonomy'
import type { SearchFilters, SearchFilterValue } from '@/lib/search-filters'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FilterSection } from './FilterSection'

export function FilterPill({ definition, filters, onChange }: { definition: TalentFilterDefinition; filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  const [open, setOpen] = useState(false)
  const [draftValue, setDraftValue] = useState<SearchFilterValue | undefined>(filters[definition.key as keyof SearchFilters])
  const active = filters[definition.key as keyof SearchFilters] !== undefined
  const draft = { ...filters, [definition.key]: draftValue }

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Re-seed the draft from the applied filters every time the panel opens,
    // so a previously abandoned draft never leaks into a fresh session.
    if (next) setDraftValue(filters[definition.key as keyof SearchFilters])
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={`flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.8rem] font-medium outline-none transition-[transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] ${
              active
                ? 'border-transparent bg-secondary text-secondary-foreground'
                : 'border-border bg-background hover:bg-muted hover:text-foreground'
            }`}
          />
        }
      >
        {definition.label}
        <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(20rem,calc(100vw-2rem))] gap-4 p-4">
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
            setOpen(false)
          }}
        >
          Show results
        </Button>
      </PopoverContent>
    </Popover>
  )
}
