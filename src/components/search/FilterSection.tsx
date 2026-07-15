'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { TalentFilterDefinition } from '@/lib/filter-taxonomy'
import type { NumericRange, SearchFilters, SearchFilterValue } from '@/lib/search-filters'

interface FilterSectionProps {
  definition: TalentFilterDefinition
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  compact?: boolean
}

function humanise(value: string) {
  return value.replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase())
}

export function FilterSection({ definition, filters, onChange, compact = false }: FilterSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [optionSearch, setOptionSearch] = useState('')
  const value = filters[definition.key as keyof SearchFilters]

  function update(next: SearchFilterValue | undefined) {
    const updated = { ...filters }
    if (next === undefined || next === '' || Array.isArray(next) && next.length === 0 || typeof next === 'object' && !Array.isArray(next) && next.min === undefined && next.max === undefined) {
      delete updated[definition.key as keyof SearchFilters]
    } else updated[definition.key as keyof SearchFilters] = next
    onChange(updated)
  }

  if (definition.dependsOn && filters[definition.dependsOn.key as keyof SearchFilters] !== definition.dependsOn.value) return null

  if (definition.kind === 'boolean') {
    return (
      <div className={compact ? '' : 'space-y-2'}>
        {!compact && <p className="text-sm font-medium">{definition.label}</p>}
        <div className="grid grid-cols-3 gap-2">
          {([['Any', undefined], ['Yes', true], ['No', false]] as const).map(([label, next]) => (
            <Button key={label} type="button" variant={value === next || next === undefined && value === undefined ? 'secondary' : 'outline'} className={value === next || next === undefined && value === undefined ? 'border-primary bg-primary/10 text-primary' : ''} onClick={() => update(next)}>{label}</Button>
          ))}
        </div>
      </div>
    )
  }

  if (definition.kind === 'range') {
    const range = value && typeof value === 'object' && !Array.isArray(value) ? value as NumericRange : {}
    return (
      <div className="space-y-2">
        {!compact && <p className="text-sm font-medium">{definition.label}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min={definition.min} max={definition.max} value={range.min ?? ''} onChange={event => update({ ...range, min: event.target.value ? Number(event.target.value) : undefined })} placeholder={`Min${definition.unit ? ` ${definition.unit}` : ''}`} aria-label={`Minimum ${definition.label}`} />
          <Input type="number" min={definition.min} max={definition.max} value={range.max ?? ''} onChange={event => update({ ...range, max: event.target.value ? Number(event.target.value) : undefined })} placeholder={`Max${definition.unit ? ` ${definition.unit}` : ''}`} aria-label={`Maximum ${definition.label}`} />
        </div>
      </div>
    )
  }

  if (definition.kind === 'text') {
    return (
      <div className="space-y-2">
        {!compact && <p className="text-sm font-medium">{definition.label}</p>}
        <Input value={typeof value === 'string' ? value : ''} onChange={event => update(event.target.value || undefined)} placeholder={definition.label} />
      </div>
    )
  }

  if (definition.kind === 'single') {
    return (
      <div className="space-y-2">
        {!compact && <p className="text-sm font-medium">{definition.label}</p>}
        <select value={typeof value === 'string' ? value : ''} onChange={event => update(event.target.value || undefined)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
          <option value="">Any</option>
          {definition.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    )
  }

  const selected = Array.isArray(value) ? value : []
  const options = definition.options?.filter(option => option.label.toLowerCase().includes(optionSearch.toLowerCase())) ?? []
  const visibleOptions = expanded || compact ? options : options.slice(0, definition.topOptions ?? 6)

  return (
    <div className="space-y-2">
      {!compact && <p className="text-sm font-medium">{definition.label}</p>}
      {(definition.allowCustom || options.length > 12) && <Input value={optionSearch} onChange={event => setOptionSearch(event.target.value)} placeholder={`Find ${definition.label.toLowerCase()}`} />}
      {visibleOptions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleOptions.map(option => (
            <Label key={option.value} className="flex min-h-9 items-center gap-2 rounded-lg border border-border/80 bg-background px-3 text-xs font-normal">
              <Checkbox checked={selected.includes(option.value)} onCheckedChange={checked => update(checked ? [...selected, option.value] : selected.filter(item => item !== option.value))} />
              {option.label}
            </Label>
          ))}
        </div>
      )}
      {definition.allowCustom && optionSearch.trim() && !options.some(option => option.label.toLowerCase() === optionSearch.trim().toLowerCase()) && (
        <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => { const custom = optionSearch.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); if (custom) update([...selected, custom]); setOptionSearch('') }}>Add “{optionSearch.trim()}”</Button>
      )}
      {!compact && options.length > (definition.topOptions ?? 6) && <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => setExpanded(current => !current)}>{expanded ? 'Show less' : 'Show more'}</Button>}
      {selected.length > 0 && <p className="text-[11px] text-muted-foreground">{selected.map(item => definition.options?.find(option => option.value === item)?.label ?? humanise(item)).join(', ')}</p>}
    </div>
  )
}
