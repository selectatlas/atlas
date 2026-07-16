'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ThreadMessage } from '@/lib/messages-view'

type ThreadChannelHandlers = {
  onInsert: (message: ThreadMessage) => void
  onTyping: (profileId: string) => void
  onRead: (profileId: string, lastReadAt: string) => void
}

const TYPING_THROTTLE_MS = 2000

/**
 * One realtime channel per open thread carrying three signals:
 * postgres INSERTs (new messages), and best-effort `typing` / `read`
 * broadcasts. Correctness never depends on the broadcasts - read state is
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

  return { sendTyping, sendRead }
}
