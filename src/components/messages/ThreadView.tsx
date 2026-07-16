'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSetPageShell } from '@/components/layout/use-set-page-shell'
import { useInbox } from '@/components/layout/inbox-context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ThreadHeader } from '@/components/messages/ThreadHeader'
import { MessageBubble } from '@/components/messages/MessageBubble'
import { DayDivider } from '@/components/messages/DayDivider'
import { TypingIndicator } from '@/components/messages/TypingIndicator'
import { MessageComposer } from '@/components/messages/MessageComposer'
import { ContextRail } from '@/components/messages/ContextRail'
import { useThreadChannel } from '@/components/messages/use-thread-channel'
import { emitThreadsChanged, type ThreadDetail } from '@/components/messages/types'
import {
  groupMessagesByDay,
  isSeen,
  lastOwnMessageId,
  type ThreadMessage,
} from '@/lib/messages-view'

const TYPING_CLEAR_MS = 3500

export function ThreadView({ threadId }: { threadId: string }) {
  const router = useRouter()
  const { refresh: refreshInbox } = useInbox()

  const [detail, setDetail] = useState<ThreadDetail | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const [archived, setArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<number | undefined>(undefined)

  const { sendTyping, sendRead } = useThreadChannel(threadId, userId, {
    onInsert: message => {
      setMessages(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]))
      setOtherTyping(false)
    },
    onTyping: () => {
      setOtherTyping(true)
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = window.setTimeout(() => setOtherTyping(false), TYPING_CLEAR_MS)
    },
    onRead: (_profileId, lastReadAt) => {
      setOtherLastReadAt(lastReadAt)
    },
  })

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/threads/${threadId}`)
      if (!res.ok) {
        router.push('/messages')
        return
      }
      const data = (await res.json()) as ThreadDetail
      setDetail(data)
      setMessages(data.messages ?? [])
      setArchived(data.archived)
      setOtherLastReadAt(data.other?.last_read_at ?? null)
      // The GET marked the thread read; tell the other side so their "Seen"
      // updates live, and refresh our own badge counts.
      sendRead(data.read_at)
      void refreshInbox()
    } catch {
      router.push('/messages')
    }
    setLoading(false)
  }, [threadId, router, refreshInbox, sendRead])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      setUserId(user?.id ?? null)
      void loadThread()
    })()
    return () => {
      cancelled = true
      window.clearTimeout(typingTimerRef.current)
    }
  }, [loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, otherTyping])

  const handleSend = useCallback(
    async (content: string): Promise<string | null> => {
      try {
        const response = await fetch(`/api/messages/threads/${threadId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          return (data as { error?: string }).error ?? 'Message could not be sent'
        }
        const data = (await response.json()) as { message?: ThreadMessage }
        if (data.message) {
          setMessages(prev =>
            prev.some(m => m.id === data.message!.id) ? prev : [...prev, data.message!],
          )
        }
        return null
      } catch {
        return 'Message could not be sent'
      }
    },
    [threadId],
  )

  const handleToggleArchive = useCallback(async () => {
    const next = !archived
    setArchived(next)
    try {
      const res = await fetch(`/api/messages/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: next }),
      })
      if (!res.ok) throw new Error('archive failed')
      emitThreadsChanged()
      void refreshInbox()
    } catch {
      setArchived(!next)
    }
  }, [archived, threadId, refreshInbox])

  const handleToggleDetails = useCallback(() => {
    if (window.matchMedia('(min-width: 1280px)').matches) {
      setRailOpen(prev => !prev)
    } else {
      setSheetOpen(true)
    }
  }, [])

  const shellOverride = useMemo(
    () => ({
      breadcrumbs: [
        { label: 'Messages', href: '/messages' },
        { label: detail?.other?.full_name ?? 'Conversation' },
      ],
      hideTitle: true,
    }),
    [detail?.other?.full_name],
  )
  useSetPageShell(loading ? { breadcrumbsLoading: true } : shellOverride)

  const dayGroups = useMemo(() => groupMessagesByDay(messages), [messages])
  const seenMessageId = useMemo(() => {
    if (!userId) return null
    const lastOwn = lastOwnMessageId(messages, userId)
    if (!lastOwn) return null
    const message = messages.find(m => m.id === lastOwn)
    return message && isSeen(message, otherLastReadAt) ? lastOwn : null
  }, [messages, userId, otherLastReadAt])

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-[53px] shrink-0 items-center border-b border-border/80 px-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex-1" />
      </div>
    )
  }

  if (!detail) return null

  const railProps = {
    otherId: detail.other?.profile_id ?? null,
    otherName: detail.other?.full_name ?? 'Conversation',
    origin: detail.origin,
    threadCreatedAt: detail.created_at,
    messageCount: messages.length,
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ThreadHeader
          other={detail.other}
          origin={detail.origin}
          archived={archived}
          onToggleArchive={() => void handleToggleArchive()}
          onToggleDetails={handleToggleDetails}
        />

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
            </div>
          ) : (
            dayGroups.map(group => (
              <div key={group.dayKey} className="space-y-2">
                <DayDivider label={group.label} />
                {group.messages.map(message => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isMine={message.sender_id === userId}
                    seen={message.id === seenMessageId}
                  />
                ))}
              </div>
            ))
          )}
          {otherTyping && <TypingIndicator name={detail.other?.full_name ?? 'Someone'} />}
          <div ref={bottomRef} />
        </div>

        <MessageComposer threadId={threadId} onSend={handleSend} onTyping={sendTyping} />
      </div>

      {railOpen && (
        <aside className="hidden w-[300px] shrink-0 border-l border-border/80 xl:block">
          <ContextRail {...railProps} />
        </aside>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[85vw] gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border/80 px-4 py-3">
            <SheetTitle className="text-sm">Details</SheetTitle>
          </SheetHeader>
          <ContextRail {...railProps} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
