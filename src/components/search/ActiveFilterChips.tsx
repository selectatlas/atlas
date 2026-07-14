'use client'

import { X } from 'lucide-react'
import { FILTER_BY_KEY } from '@/lib/filter-taxonomy'
import type { SearchFilters } from '@/lib/search-filters'

export function ActiveFilterChips({ filters, onChange }: { filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  const entries = Object.entries(filters)
  if (entries.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2" aria-label="Active filters">
      {entries.map(([key, value]) => {
        const definition = FILTER_BY_KEY.get(key)
        const text = Array.isArray(value)
          ? value.map(item => definition?.options?.find(option => option.value === item)?.label ?? item.replace(/_/g, ' ')).join(', ')
          : typeof value === 'object'
            ? `${value.min ?? 'Any'}–${value.max ?? 'Any'}${definition?.unit ? ` ${definition.unit}` : ''}`
            : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
        return (
          <button key={key} type="button" onClick={() => { const next = { ...filters }; delete next[key as keyof SearchFilters]; onChange(next) }} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
            <span className="truncate">{definition?.label ?? key}: {text}</span><X className="size-3" />
          </button>
        )
      })}
    </div>
  )
}
