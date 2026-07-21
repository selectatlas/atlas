'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { formatMessageTime, type ThreadMessage } from '@/lib/messages-view'
import type { ReactionPill } from '@/lib/reactions'
import { MessageActionsMenu } from '@/components/messages/MessageActionsMenu'
import { QuotedMessage } from '@/components/messages/QuotedMessage'
import { ReactionPills } from '@/components/messages/ReactionPills'
import { useLongPress } from '@/components/messages/use-long-press'

export function MessageBubble({
  message,
  isMine,
  seen,
  quoted,
  quotedSenderName,
  reactionPills = [],
  myReaction = null,
  onReact,
  onReply,
  onQuoteClick,
}: {
  message: ThreadMessage
  isMine: boolean
  seen?: boolean
  quoted?: ThreadMessage | null
  quotedSenderName?: string
  reactionPills?: ReactionPill[]
  myReaction?: string | null
  onReact?: (emoji: string | null) => void
  onReply?: () => void
  onQuoteClick?: (messageId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPress = useLongPress(() => setMenuOpen(true))
  const hasActions = Boolean(onReact && onReply)

  const bubble = (
    <div
      {...(hasActions ? longPress : {})}
      data-message-id={message.id}
      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm select-none [-webkit-touch-callout:none] sm:select-text ${
        isMine
          ? 'rounded-br-md bg-primary text-primary-foreground'
          : 'rounded-bl-md bg-muted text-foreground'
      }`}
    >
      {message.reply_to_id != null && (
        <QuotedMessage
          quoted={quoted ?? null}
          quotedSenderName={quotedSenderName ?? ''}
          isMine={isMine}
          onClick={quoted && onQuoteClick ? () => onQuoteClick(quoted.id) : undefined}
        />
      )}
      <p className="whitespace-pre-wrap break-words">{message.content}</p>
      <p className={`mt-1 text-xs ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
        {formatMessageTime(message.created_at)}
      </p>
    </div>
  )

  return (
    <div className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      <div className={`flex max-w-full items-center gap-1 ${isMine ? 'flex-row-reverse' : ''}`}>
        {bubble}
        {onReact && onReply && (
          <MessageActionsMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            message={message}
            myReaction={myReaction}
            onReact={onReact}
            onReply={onReply}
            isMine={isMine}
            trigger={
              <button
                type="button"
                aria-label="Message actions"
                className={`shrink-0 rounded-full p-1 text-muted-foreground transition-opacity hover:bg-muted focus-visible:opacity-100 ${
                  menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
        )}
      </div>
      <ReactionPills
        pills={reactionPills}
        isMine={isMine}
        onToggle={(emoji, mine) => onReact?.(mine ? null : emoji)}
      />
      {seen && <p className="mt-1 pr-1 text-[11px] text-muted-foreground">Seen</p>}
    </div>
  )
}
