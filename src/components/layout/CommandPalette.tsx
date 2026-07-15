'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Compass,
  Home,
  MessageSquare,
  Search,
  Send,
  Settings,
  UserRound,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAppShell } from '@/components/layout/app-shell-context'
import { getSearchTarget } from '@/lib/page-meta'

type CommandItem = {
  id: string
  label: string
  href?: string
  action?: () => void
  keywords?: string
  icon: typeof Home
}

export function CommandPalette() {
  const router = useRouter()
  const { accountType } = useAppShell()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(current => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const items = useMemo<CommandItem[]>(() => {
    const searchTarget = getSearchTarget(accountType)
    const shared: CommandItem[] = [
      { id: 'home', label: 'Home', href: '/home', icon: Home, keywords: 'dashboard' },
      { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare },
      { id: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
      { id: 'profile', label: 'Profile', href: '/profile', icon: UserRound },
    ]

    const roleItems: CommandItem[] =
      accountType === 'hirer'
        ? [
            { id: 'search', label: 'Search talent', href: '/search', icon: Search, keywords: 'find browse' },
            { id: 'jobs', label: 'My jobs', href: '/jobs', icon: BriefcaseBusiness },
            { id: 'outreach', label: 'Outreach', href: '/outreach', icon: Send },
            { id: 'shortlists', label: 'Saved talent', href: '/shortlists', icon: Bookmark },
          ]
        : [
            { id: 'discover', label: 'Discover jobs', href: '/discover', icon: Compass, keywords: 'jobs opportunities' },
          ]

    const searchAction: CommandItem = {
      id: 'search-query',
      label: query.trim() ? `Search for “${query.trim()}”` : 'Open search',
      action: () => {
        const trimmed = query.trim()
        router.push(trimmed ? `${searchTarget}?q=${encodeURIComponent(trimmed)}` : searchTarget)
        setOpen(false)
      },
      icon: Search,
      keywords: query,
    }

    return [searchAction, ...roleItems, ...shared]
  }, [accountType, query, router])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter(item => {
      const haystack = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [items, query])

  function runItem(item: CommandItem) {
    setOpen(false)
    setQuery('')
    if (item.action) {
      item.action()
      return
    }
    if (item.href) router.push(item.href)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Jump to a page or run a search
          </DialogDescription>
          <Input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search pages or talent…"
            className="mt-2"
            aria-label="Command palette search"
          />
          <p className="mt-2 text-xs text-muted-foreground">Tip: ⌘K anywhere in the app</p>
        </DialogHeader>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</li>
          ) : (
            filtered.map(item => {
              const Icon = item.icon
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => {
                        setOpen(false)
                        setQuery('')
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runItem(item)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </button>
                  )}
                </li>
              )
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
