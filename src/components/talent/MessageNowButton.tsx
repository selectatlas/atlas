'use client'

import { MessageSquare } from 'lucide-react'

// "Message now" straight from the card (client feedback 20 Jul 2026, after
// the Collabstr reference) - opens the existing outreach flow without
// visiting the profile. Rendered only when a handler is passed, so
// server-rendered card grids (e.g. SimilarTalent) simply omit it.
export function MessageNowButton({ name, onMessage }: { name: string; onMessage: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Message ${name}`}
      onClick={event => {
        // The whole card is a link - the button must not navigate.
        event.preventDefault()
        event.stopPropagation()
        onMessage()
      }}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-colors duration-[var(--duration-fast)] hover:bg-background"
    >
      <MessageSquare className="size-4" />
    </button>
  )
}
