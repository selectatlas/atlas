'use client'

import type { ReactionPill } from '@/lib/reactions'

export function ReactionPills({
  pills,
  isMine,
  onToggle,
}: {
  pills: ReactionPill[]
  isMine: boolean
  onToggle: (emoji: string, mine: boolean) => void
}) {
  if (pills.length === 0) return null
  return (
    <div className={`-mt-1.5 flex gap-1 ${isMine ? 'justify-end pr-2' : 'pl-2'}`}>
      {pills.map(pill => (
        <button
          key={pill.emoji}
          type="button"
          onClick={() => onToggle(pill.emoji, pill.mine)}
          aria-label={`${pill.emoji} ${pill.count}${pill.mine ? ', you reacted' : ''}`}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-sm transition-colors ${
            pill.mine
              ? 'border-primary/40 bg-primary/10'
              : 'border-border/80 bg-background hover:bg-muted'
          }`}
        >
          <span>{pill.emoji}</span>
          {pill.count > 1 && <span className="text-muted-foreground">{pill.count}</span>}
        </button>
      ))}
    </div>
  )
}
