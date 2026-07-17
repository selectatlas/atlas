'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { NotificationRow } from '@/components/notifications/NotificationRow'
import { isActiveLocalDemoMode } from '@/lib/demo-mode'
import type { InboxNotification } from '@/lib/inbox'

export function NotificationsPage() {
  const [items, setItems] = useState<InboxNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (await isActiveLocalDemoMode()) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const response = await fetch('/api/notifications')
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) setItems(data.notifications ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <PageShell />

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Bell className="size-5" />
          </div>
          <p className="font-medium">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">New activity will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Link href="/settings?section=notifications" className="text-sm font-medium text-primary hover:underline">
              Notification settings
            </Link>
          </div>
          {items.map(item => (
            <NotificationRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
