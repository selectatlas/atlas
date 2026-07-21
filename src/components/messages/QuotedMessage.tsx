'use client'

import { quotedSnippet } from '@/lib/reactions'
import type { ThreadMessage } from '@/lib/messages-view'

// Compact quote block rendered inside a reply bubble. `quoted` is null when
// the original message falls outside the loaded window.
export function QuotedMessage({
  quoted,
  quotedSenderName,
  isMine,
  onClick,
}: {
  quoted: ThreadMessage | null
  quotedSenderName: string
  isMine: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!quoted}
      className={`mb-1.5 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left text-xs ${
        isMine
          ? 'border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/80'
          : 'border-primary/50 bg-foreground/5 text-muted-foreground'
      }`}
    >
      <span className="block font-medium">{quoted ? quotedSenderName : 'Earlier message'}</span>
      {quoted && <span className="block truncate">{quotedSnippet(quoted.content, 90)}</span>}
    </button>
  )
}
