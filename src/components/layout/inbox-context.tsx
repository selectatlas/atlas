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
    void refresh()

    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    void (async () => {
      if (await isActiveLocalDemoMode()) return
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel('inbox-summary')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          void refresh()
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, () => {
          void refresh()
        })
        .subscribe()
    })()

    const interval = window.setInterval(() => { void refresh() }, 60_000)

    return () => {
      window.clearInterval(interval)
      if (channel) {
        void createClient().removeChannel(channel)
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
