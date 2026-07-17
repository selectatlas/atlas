'use client'

import Link from 'next/link'
import { BriefcaseBusiness } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { nameInitial } from '@/lib/display'
import { formatThreadTime } from '@/lib/messages-view'
import { isSystemMessageKind } from '@/lib/system-messages'
import type { ThreadListItem } from '@/components/messages/types'

export function ConversationListItem({
  thread,
  userId,
  active,
}: {
  thread: ThreadListItem
  userId: string | null
  active: boolean
}) {
  return (
    <Link
      href={`/messages/${thread.id}`}
      aria-current={active ? 'page' : undefined}
      className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
        active ? 'bg-sidebar-accent' : 'hover:bg-muted/60'
      }`}
    >
      <Avatar className="h-10 w-10 shrink-0 rounded-xl">
        <AvatarImage src={thread.otherAvatar ?? ''} alt={thread.otherName} />
        <AvatarFallback className="rounded-xl text-base font-bold">
          {nameInitial(thread.otherName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${thread.unread ? 'font-semibold text-foreground' : 'font-medium'}`}>
            {thread.otherName}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {thread.unread && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
            <span className="text-xs text-muted-foreground">{formatThreadTime(thread.lastMessageAt)}</span>
          </div>
        </div>
        <p className={`mt-0.5 truncate text-xs ${thread.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
          {thread.lastSenderId === userId && !isSystemMessageKind(thread.lastMessageKind)
            ? 'You: '
            : ''}
          {thread.lastMessage}
        </p>
        {thread.originJobTitle && (
          <Badge variant="secondary" className="mt-1.5 max-w-full gap-1 rounded-md px-1.5 py-0 text-[10px] font-medium">
            <BriefcaseBusiness className="size-2.5 shrink-0" />
            <span className="truncate">{thread.originJobTitle}</span>
          </Badge>
        )}
      </div>
    </Link>
  )
}
