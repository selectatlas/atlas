'use client'

import { formatMessageTime, type ThreadMessage } from '@/lib/messages-view'

export function MessageBubble({
  message,
  isMine,
  seen,
}: {
  message: ThreadMessage
  isMine: boolean
  seen?: boolean
}) {
  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isMine
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md bg-muted text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`mt-1 text-xs ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatMessageTime(message.created_at)}
        </p>
      </div>
      {seen && <p className="mt-1 pr-1 text-[11px] text-muted-foreground">Seen</p>}
    </div>
  )
}
