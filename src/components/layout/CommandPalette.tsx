'use client'

import { useEffect, useMemo, useState } from 'react'
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
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useAppShell } from '@/components/layout/app-shell-context'
import { getSearchTarget } from '@/lib/page-meta'

type CommandEntry = {
  id: string
  label: string
  href: string
  keywords?: string[]
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

  const searchTarget = getSearchTarget(accountType)

  const roleItems = useMemo<CommandEntry[]>(
    () =>
      accountType === 'hirer'
        ? [
            { id: 'search', label: 'Search talent', href: '/search', icon: Search, keywords: ['find', 'browse'] },
            { id: 'jobs', label: 'My jobs', href: '/jobs', icon: BriefcaseBusiness },
            { id: 'outreach', label: 'Outreach', href: '/outreach', icon: Send },
            { id: 'shortlists', label: 'Saved talent', href: '/shortlists', icon: Bookmark, keywords: ['liked', 'bookmarks'] },
          ]
        : [
            { id: 'discover', label: 'Discover jobs', href: '/discover', icon: Compass, keywords: ['jobs', 'opportunities'] },
          ],
    [accountType],
  )

  const sharedItems = useMemo<CommandEntry[]>(
    () => [
      { id: 'home', label: 'Home', href: '/home', icon: Home, keywords: ['dashboard'] },
      { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare, keywords: ['inbox', 'chat'] },
      { id: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
      { id: 'profile', label: 'Profile', href: '/profile', icon: UserRound },
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
    ],
    [],
  )

  function close() {
    setOpen(false)
    setQuery('')
  }

  function goTo(href: string) {
    close()
    router.push(href)
  }

  function runSearch() {
    const trimmed = query.trim()
    goTo(trimmed ? `${searchTarget}?q=${encodeURIComponent(trimmed)}` : searchTarget)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setQuery('')
      }}
      title="Command palette"
      description="Jump to a page or run a search"
    >
      <CommandInput
        placeholder="Search pages or talent…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches</CommandEmpty>
        <CommandGroup heading="Search">
          <CommandItem
            value={`search-query ${query}`.trim()}
            onSelect={runSearch}
          >
            <Search className="text-muted-foreground" />
            <span>{query.trim() ? `Search for “${query.trim()}”` : 'Open search'}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={accountType === 'hirer' ? 'Hiring' : 'Discover'}>
          {roleItems.map(item => {
            const Icon = item.icon
            return (
              <CommandItem key={item.id} value={item.label} keywords={item.keywords} onSelect={() => goTo(item.href)}>
                <Icon className="text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          {sharedItems.map(item => {
            const Icon = item.icon
            return (
              <CommandItem key={item.id} value={item.label} keywords={item.keywords} onSelect={() => goTo(item.href)}>
                <Icon className="text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> to navigate ·{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd> to select ·{' '}
        <kbd className="rounded border bg-muted px-1 font-mono">⌘K</kbd> to toggle
      </div>
    </CommandDialog>
  )
}
