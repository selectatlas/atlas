'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
          <Button key={key} type="button" variant="secondary" size="xs" className="max-w-full rounded-full" aria-label={`Remove ${definition?.label ?? key} filter`} onClick={() => { const next = { ...filters }; delete next[key as keyof SearchFilters]; onChange(next) }}>
            <span className="truncate">{definition?.label ?? key}: {text}</span><X className="size-3" />
          </Button>
        )
      })}
    </div>
  )
}
