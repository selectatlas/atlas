'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ThreadMessage } from '@/lib/messages-view'
import type { ReactionEvent } from '@/lib/reactions'

type ThreadChannelHandlers = {
  onInsert: (message: ThreadMessage) => void
  onTyping: (profileId: string) => void
  onRead: (profileId: string, lastReadAt: string) => void
  onReaction: (event: ReactionEvent) => void
}

const TYPING_THROTTLE_MS = 2000

/**
 * One realtime channel per open thread carrying postgres INSERTs (new
 * messages) plus best-effort `typing` / `read` / `reaction` broadcasts.
 * Correctness never depends on the broadcasts - read and reaction state are
 * always seeded from the thread GET.
 */
export function useThreadChannel(
  threadId: string,
  userId: string | null,
  handlers: ThreadChannelHandlers,
) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastTypingSentRef = useRef(0)
  // A read receipt requested before the channel finishes subscribing is held
  // here and flushed on SUBSCRIBED, so the common load-then-mark-read path
  // does not race the websocket handshake.
  const pendingReadRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    // The browser client is a singleton and channel() reuses topics; drop any
    // stale channel left behind by Strict Mode before re-attaching listeners.
    const stale = supabase.getChannels().find(ch => ch.topic === `realtime:thread-${threadId}`)
    if (stale) void supabase.removeChannel(stale)

    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        payload => {
          handlersRef.current.onInsert(payload.new as ThreadMessage)
        },
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const profileId = (payload as { profile_id?: string }).profile_id
        if (profileId && profileId !== userId) handlersRef.current.onTyping(profileId)
      })
      .on('broadcast', { event: 'read' }, ({ payload }) => {
        const { profile_id, last_read_at } = payload as { profile_id?: string; last_read_at?: string }
        if (profile_id && last_read_at && profile_id !== userId) {
          handlersRef.current.onRead(profile_id, last_read_at)
        }
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const { message_id, profile_id, emoji } = payload as {
          message_id?: string
          profile_id?: string
          emoji?: string | null
        }
        if (message_id && profile_id && profile_id !== userId) {
          handlersRef.current.onReaction({ message_id, profile_id, emoji: emoji ?? null })
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED' && pendingReadRef.current) {
          const lastReadAt = pendingReadRef.current
          pendingReadRef.current = null
          void channel.send({
            type: 'broadcast',
            event: 'read',
            payload: { profile_id: userId, last_read_at: lastReadAt },
          })
        }
      })

    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [threadId, userId])

  const sendTyping = useCallback(() => {
    if (!userId) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return
    lastTypingSentRef.current = now
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { profile_id: userId },
    })
  }, [userId])

  const sendRead = useCallback(
    (lastReadAt: string) => {
      if (!userId) return
      const channel = channelRef.current
      if (!channel || channel.state !== 'joined') {
        pendingReadRef.current = lastReadAt
        return
      }
      void channel.send({
        type: 'broadcast',
        event: 'read',
        payload: { profile_id: userId, last_read_at: lastReadAt },
      })
    },
    [userId],
  )

  const sendReaction = useCallback(
    (event: Omit<ReactionEvent, 'profile_id'>) => {
      if (!userId) return
      void channelRef.current?.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { ...event, profile_id: userId },
      })
    },
    [userId],
  )

  return { sendTyping, sendRead, sendReaction }
}
