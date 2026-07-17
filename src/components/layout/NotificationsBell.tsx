'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useInbox } from '@/components/layout/inbox-context'
import { NotificationRow } from '@/components/notifications/NotificationRow'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { isActiveLocalDemoMode } from '@/lib/demo-mode'
import type { InboxNotification } from '@/lib/inbox'

const BELL_CLASSES =
  'relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-muted hover:text-foreground active:scale-[0.97]'

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function NotificationsBell() {
  const { summary } = useInbox()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<InboxNotification[]>([])
  const [loading, setLoading] = useState(false)

  const label = `Notifications${summary.totalUnread > 0 ? `, ${summary.totalUnread} unread` : ''}`

  const loadLatest = useCallback(async () => {
    setLoading(true)
    try {
      if (await isActiveLocalDemoMode()) {
        setItems([])
        return
      }
      const response = await fetch('/api/notifications')
      if (!response.ok) return
      const data = (await response.json()) as { notifications?: InboxNotification[] }
      setItems((data.notifications ?? []).slice(0, 3))
    } catch {
      // Best-effort preview; the full page remains the fallback.
    } finally {
      setLoading(false)
    }
  }, [])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) void loadLatest()
  }

  return (
    <>
      {/* Small viewports keep the direct link to the notifications page. */}
      <Link href="/notifications" aria-label={label} className={`${BELL_CLASSES} md:hidden`}>
        <Bell className="size-4" />
        <CountBadge count={summary.totalUnread} />
      </Link>

      {/* md and up: compact dropdown with the latest notifications. */}
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          render={
            <button type="button" aria-label={label} className={`${BELL_CLASSES} hidden md:inline-flex`} />
          }
        >
          <Bell className="size-4" />
          <CountBadge count={summary.totalUnread} />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 gap-0 p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {summary.totalUnread > 0 && (
              <span className="text-xs text-muted-foreground">{summary.totalUnread} unread</span>
            )}
          </div>
          <Separator />
          {loading ? (
            <div className="space-y-2 p-3" aria-label="Loading notifications">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">New activity will show up here.</p>
            </div>
          ) : (
            <div className="p-1.5">
              {items.map(item => (
                <NotificationRow key={item.id} item={item} compact onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )}
          <Separator />
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            See all notifications
          </Link>
        </PopoverContent>
      </Popover>
    </>
  )
}
