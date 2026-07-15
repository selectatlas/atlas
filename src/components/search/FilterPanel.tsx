'use client'

import { useState } from 'react'
import { Check, MapPin, SlidersHorizontal, X } from 'lucide-react'
import type { Category } from '@/types'
import { CATEGORY_LABELS } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FilterPanelProps {
  category: Category | 'all'
  location: string
  onCategoryChange: (c: Category | 'all') => void
  onLocationChange: (l: string) => void
  resultCount: number
  availableOnly?: boolean
  onAvailableOnlyChange?: (v: boolean) => void
  hasShowreelOnly?: boolean
  onHasShowreelOnlyChange?: (v: boolean) => void
}

const CATEGORIES: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: 'All talent' },
  { value: 'dancer', label: CATEGORY_LABELS.dancer + 's' },
  { value: 'actor', label: CATEGORY_LABELS.actor + 's' },
  { value: 'photographer_videographer', label: 'Photo & video' },
  { value: 'content_creator', label: CATEGORY_LABELS.content_creator + 's' },
]

export function FilterPanel({
  category,
  location,
  onCategoryChange,
  onLocationChange,
  resultCount,
  availableOnly = false,
  onAvailableOnlyChange,
  hasShowreelOnly = false,
  onHasShowreelOnlyChange,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false)
  const activeCount = Number(category !== 'all') + Number(Boolean(location)) + Number(availableOnly) + Number(hasShowreelOnly)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={activeCount > 0 ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          className="gap-2"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>

        <div className="relative min-w-[190px] flex-1 sm:max-w-xs">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={location}
            onChange={e => onLocationChange(e.target.value)}
            placeholder="Filter by location"
            aria-label="Filter by location"
            className="h-8 pl-9 pr-8 text-xs"
          />
          {location && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onLocationChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear location filter"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {resultCount} {resultCount === 1 ? 'talent' : 'talents'}
        </span>
      </div>

      {open && (
        <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map(cat => {
              const selected = category === cat.value
              return (
                <Button
                  type="button"
                  key={cat.value}
                  size="sm"
                  variant={selected ? 'default' : 'outline'}
                  onClick={() => onCategoryChange(cat.value)}
                >
                  {selected && <Check className="size-3.5" />}
                  {cat.label}
                </Button>
              )
            })}

            {onAvailableOnlyChange && (
              <Button
                type="button"
                size="sm"
                variant={availableOnly ? 'secondary' : 'outline'}
                className={availableOnly ? 'border-primary/30 bg-primary/10 text-primary' : ''}
                onClick={() => onAvailableOnlyChange(!availableOnly)}
              >
                <span className={`size-1.5 rounded-full ${availableOnly ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                Available now
              </Button>
            )}

            {onHasShowreelOnlyChange && (
              <Button
                type="button"
                size="sm"
                variant={hasShowreelOnly ? 'secondary' : 'outline'}
                className={hasShowreelOnly ? 'border-primary/30 bg-primary/10 text-primary' : ''}
                onClick={() => onHasShowreelOnlyChange(!hasShowreelOnly)}
              >
                Has showreel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
