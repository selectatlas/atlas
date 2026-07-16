'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Inbox, SearchX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActiveLocalDemoMode } from '@/lib/demo-mode'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppShell } from '@/components/layout/app-shell-context'
import { ConversationListItem } from '@/components/messages/ConversationListItem'
import { NewMessageDialog } from '@/components/messages/NewMessageDialog'
import { THREADS_CHANGED_EVENT, type ThreadListItem } from '@/components/messages/types'

type ThreadFilter = 'open' | 'archived'

export function ConversationListPane() {
  const { accountType } = useAppShell()
  const [threads, setThreads] = useState<ThreadListItem[]>([])
  const [filter, setFilter] = useState<ThreadFilter>('open')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const activeThreadId = useSelectedLayoutSegment()
  const filterRef = useRef(filter)
  useEffect(() => {
    filterRef.current = filter
  }, [filter])

  const loadThreads = useCallback(async (target?: ThreadFilter) => {
    try {
      const res = await fetch(`/api/messages/threads?filter=${target ?? filterRef.current}`)
      if (!res.ok) throw new Error('Unable to load messages')
      const data = await res.json()
      setThreads(data.threads ?? [])
      setLoadError(null)
    } catch {
      setLoadError('Unable to load messages')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const demo = await isActiveLocalDemoMode()
      if (cancelled) return
      if (demo) {
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setLoadError('Unable to load messages')
        setLoading(false)
        return
      }
      setUserId(user.id)
      void loadThreads()
    })()

    return () => { cancelled = true }
  }, [loadThreads])

  // Realtime: refresh on any new message (debounced); plus explicit refreshes
  // when a thread is archived/unarchived elsewhere in the app.
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    let debounce: number | undefined

    const scheduleRefresh = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => { void loadThreads() }, 250)
    }

    const stale = supabase.getChannels().find(ch => ch.topic === 'realtime:messages-list')
    if (stale) void supabase.removeChannel(stale)

    const channel = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, scheduleRefresh)
      .subscribe()

    window.addEventListener(THREADS_CHANGED_EVENT, scheduleRefresh)
    return () => {
      window.clearTimeout(debounce)
      window.removeEventListener(THREADS_CHANGED_EVENT, scheduleRefresh)
      void supabase.removeChannel(channel)
    }
  }, [userId, loadThreads])

  const switchFilter = (next: ThreadFilter) => {
    if (next === filter) return
    setFilter(next)
    setLoading(true)
    void loadThreads(next)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b border-border/80 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight">Messages</h1>
          {accountType === 'hirer' && <NewMessageDialog />}
        </div>
        <Tabs value={filter} onValueChange={value => switchFilter(value as ThreadFilter)}>
          <TabsList className="w-full">
            <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
            <TabsTrigger value="archived" className="flex-1">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))
          ) : loadError ? (
            <div className="space-y-3 px-3 py-6 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => { setLoading(true); void loadThreads() }}>
                Try again
              </Button>
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                {filter === 'archived' ? <Inbox className="size-5" /> : <SearchX className="size-5" />}
              </div>
              <p className="text-sm font-medium">
                {filter === 'archived' ? 'No archived conversations' : 'No messages yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filter === 'archived'
                  ? 'Conversations you archive will appear here.'
                  : 'Start a conversation from search, outreach, or a talent profile.'}
              </p>
            </div>
          ) : (
            threads.map(thread => (
              <ConversationListItem
                key={thread.id}
                thread={thread}
                userId={userId}
                active={thread.id === activeThreadId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
