'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SUGGESTED_SEARCHES } from '@/components/search/suggested-searches'

interface SearchSuggestionChipsProps {
  onSelect: (query: string) => void
  label?: string
  className?: string
}

export function SearchSuggestionChips({
  onSelect,
  label = 'Try searching for',
  className,
}: SearchSuggestionChipsProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_SEARCHES.map(suggestion => (
          <Button
            key={suggestion.query}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-primary/20 bg-card px-3 text-xs font-normal text-foreground shadow-sm hover:border-primary/40 hover:bg-primary/5"
            // Keep the input focused so a tap on the chip is not swallowed
            // by the input's blur handler (iOS Safari fires blur first).
            onMouseDown={e => e.preventDefault()}
            onClick={() => onSelect(suggestion.query)}
          >
            <Sparkles className="size-3 text-primary" strokeWidth={2.2} />
            {suggestion.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
