'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { isActiveLocalDemoMode } from '@/lib/demo-mode'
import type { InboxSummary } from '@/lib/inbox'

const EMPTY_SUMMARY: InboxSummary = {
  unreadMessages: 0,
  unreadApplications: 0,
  unreadOutreach: 0,
  totalUnread: 0,
}

type InboxContextValue = {
  summary: InboxSummary
  refresh: () => Promise<void>
  navBadges: Record<string, number>
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<InboxSummary>(EMPTY_SUMMARY)

  const refresh = useCallback(async () => {
    if (await isActiveLocalDemoMode()) {
      setSummary(EMPTY_SUMMARY)
      return
    }

    try {
      const response = await fetch('/api/me/inbox-summary')
      if (!response.ok) return
      const data = (await response.json()) as InboxSummary
      setSummary(data)
    } catch {
      // Best-effort badge counts.
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load badge counts on mount
    void refresh()

    // The browser Supabase client is a singleton and channel('inbox-summary')
    // returns an existing channel for the same topic. Under Strict Mode the
    // first effect run's async work can outlive its cleanup, so without the
    // cancelled guard it would call .on() on the second run's already
    // subscribed channel, which throws.
    let cancelled = false
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    const supabase = createClient()

    void (async () => {
      if (await isActiveLocalDemoMode()) return
      if (cancelled) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const stale = supabase.getChannels().find(ch => ch.topic === 'realtime:inbox-summary')
      if (stale) await supabase.removeChannel(stale)
      if (cancelled) return

      channel = supabase
        .channel('inbox-summary')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          void refresh()
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, () => {
          void refresh()
        })
        .subscribe()

      if (cancelled) {
        void supabase.removeChannel(channel)
        channel = null
      }
    })()

    const interval = window.setInterval(() => { void refresh() }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [refresh])

  const navBadges = useMemo(
    () => ({
      '/messages': summary.unreadMessages,
      '/notifications': summary.totalUnread,
    }),
    [summary],
  )

  const value = useMemo(
    () => ({ summary, refresh, navBadges }),
    [summary, refresh, navBadges],
  )

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used within InboxProvider')
  return ctx
}
