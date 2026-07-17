'use client'

import Link from 'next/link'
import { BellRing, Mail, Send, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InboxNotification } from '@/lib/inbox'

export const NOTIFICATION_KIND_LABEL: Record<InboxNotification['kind'], string> = {
  message: 'Message',
  application: 'Application',
  outreach: 'Outreach',
  saved_search: 'Saved search',
}

export const NOTIFICATION_KIND_ICON = {
  message: Mail,
  application: Sparkles,
  outreach: Send,
  saved_search: BellRing,
} as const

export function formatNotificationWhen(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return date.toLocaleDateString()
}

type NotificationRowProps = {
  item: InboxNotification
  compact?: boolean
  onNavigate?: () => void
}

export function NotificationRow({ item, compact = false, onNavigate }: NotificationRowProps) {
  const Icon = NOTIFICATION_KIND_ICON[item.kind]

  if (compact) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{item.title}</p>
            {item.unread && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-primary"
                aria-label="Unread"
              />
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.body}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {NOTIFICATION_KIND_LABEL[item.kind]} · {formatNotificationWhen(item.createdAt)}
          </p>
        </div>
      </Link>
    )
  }

  return (
    <Link href={item.href} onClick={onNavigate}>
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
              {NOTIFICATION_KIND_LABEL[item.kind]} · {formatNotificationWhen(item.createdAt)}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  )
}
