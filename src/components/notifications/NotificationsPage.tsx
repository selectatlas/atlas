'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Mail, Send, Sparkles } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { isActiveLocalDemoMode } from '@/lib/demo-mode'
import type { InboxNotification } from '@/lib/inbox'

const KIND_LABEL: Record<InboxNotification['kind'], string> = {
  message: 'Message',
  application: 'Application',
  outreach: 'Outreach',
}

const KIND_ICON = {
  message: Mail,
  application: Sparkles,
  outreach: Send,
} as const

function formatWhen(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return date.toLocaleDateString()
}

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
          {items.map(item => {
            const Icon = KIND_ICON[item.kind]
            return (
              <Link key={item.id} href={item.href}>
                <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        {item.unread && <Badge variant="default">New</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {KIND_LABEL[item.kind]} · {formatWhen(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
