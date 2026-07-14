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
            <button
              type="button"
              onClick={() => onLocationChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear location filter"
            >
              <X className="size-3.5" />
            </button>
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
                <button
                  type="button"
                  key={cat.value}
                  onClick={() => onCategoryChange(cat.value)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-[background-color,color,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98] ${
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {selected && <Check className="size-3.5" />}
                  {cat.label}
                </button>
              )
            })}

            {onAvailableOnlyChange && (
              <button
                type="button"
                onClick={() => onAvailableOnlyChange(!availableOnly)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-[background-color,color,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98] ${
                  availableOnly
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <span className={`size-1.5 rounded-full ${availableOnly ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                Available now
              </button>
            )}

            {onHasShowreelOnlyChange && (
              <button
                type="button"
                onClick={() => onHasShowreelOnlyChange(!hasShowreelOnly)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-[background-color,color,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98] ${
                  hasShowreelOnly
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                Has showreel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
