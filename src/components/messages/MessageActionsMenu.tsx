'use client'

import { Copy, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { REACTION_EMOJIS } from '@/lib/reactions'
import type { ThreadMessage } from '@/lib/messages-view'

/**
 * Per-bubble actions: react, reply, copy. The trigger is supplied by the
 * caller (hover-revealed ellipsis button); mobile long-press opens the same
 * controlled popover.
 */
export function MessageActionsMenu({
  open,
  onOpenChange,
  message,
  myReaction,
  onReact,
  onReply,
  isMine,
  trigger,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: ThreadMessage
  myReaction: string | null
  onReact: (emoji: string | null) => void
  onReply: () => void
  isMine: boolean
  trigger: React.ReactElement
}) {
  async function handleCopy() {
    onOpenChange(false)
    try {
      await navigator.clipboard.writeText(message.content)
      toast('Message copied')
    } catch {
      toast('Could not copy message')
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side="top"
        align={isMine ? 'end' : 'start'}
        className="w-auto gap-1 p-1.5"
      >
        <div className="flex gap-0.5" role="group" aria-label="React to message">
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onOpenChange(false)
                // Tapping your current reaction clears it.
                onReact(myReaction === emoji ? null : emoji)
              }}
              aria-label={`React with ${emoji}`}
              aria-pressed={myReaction === emoji}
              className={`rounded-lg p-1.5 text-lg leading-none transition-colors hover:bg-muted ${
                myReaction === emoji ? 'bg-primary/10' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="h-px bg-border/80" />
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
            onReply()
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <Reply className="size-4 text-muted-foreground" />
          Reply
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <Copy className="size-4 text-muted-foreground" />
          Copy text
        </button>
      </PopoverContent>
    </Popover>
  )
}
