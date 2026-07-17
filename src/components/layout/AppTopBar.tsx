'use client'

import { FormEvent, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Briefcase, Command, Search, type LucideIcon } from 'lucide-react'
import { PageBreadcrumbs } from '@/components/layout/PageBreadcrumbs'
import { MobileSearchSheet } from '@/components/layout/MobileSearchSheet'
import { NotificationsBell } from '@/components/layout/NotificationsBell'
import { useAppShell } from '@/components/layout/app-shell-context'
import { useInbox } from '@/components/layout/inbox-context'
import { getPageMeta, getSearchTarget } from '@/lib/page-meta'
import { Button } from '@/components/ui/button'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

type QuickTab =
  | { title: string; icon: LucideIcon; href: string; badge?: number }
  | { type: 'separator' }

// Notifications live in the bell (mobile: direct link, md+: preview popover),
// so the quick tabs only carry destinations without their own entry point.
const hirerQuickTabs: QuickTab[] = [
  { title: 'Jobs', icon: Briefcase, href: '/jobs' },
]

const talentQuickTabs: QuickTab[] = []

function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-3 w-3 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

export function AppTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { accountType, override } = useAppShell()
  const { navBadges } = useInbox()
  const [query, setQuery] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const meta = useMemo(() => {
    const base = getPageMeta(pathname, accountType)
    if (!override) return base

    return {
      ...base,
      ...override,
      breadcrumbs: override.breadcrumbs ?? base.breadcrumbs,
    }
  }, [pathname, accountType, override])

  const searchTarget = getSearchTarget(accountType)
  const searchPlaceholder =
    accountType === 'hirer' ? 'Search talent…' : 'Search jobs…'

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      router.push(searchTarget)
      return
    }
    router.push(`${searchTarget}?q=${encodeURIComponent(trimmed)}`)
  }

  function openCommandPalette() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  }

  const quickTabs = useMemo(() => {
    const base = accountType === 'hirer' ? hirerQuickTabs : talentQuickTabs
    return base.map(tab =>
      'href' in tab ? { ...tab, badge: navBadges[tab.href] } : tab,
    )
  }, [accountType, navBadges])

  function onQuickTabChange(index: number | null) {
    if (index === null) return
    const tab = quickTabs[index]
    if (tab && 'href' in tab) router.push(tab.href)
  }

  return (
    <>
      <header className="sticky top-14 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md md:top-0">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6 md:px-8 lg:px-10">
          <div className="min-w-0 flex-1">
            {override?.breadcrumbsLoading ? (
              <BreadcrumbSkeleton aria-label="Loading breadcrumbs" />
            ) : (
              <PageBreadcrumbs items={meta.breadcrumbs} />
            )}
          </div>

          <form
            onSubmit={onSearchSubmit}
            className="hidden min-w-0 flex-1 max-w-sm lg:block xl:max-w-md"
            role="search"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-9 pr-16"
                aria-label={searchPlaceholder}
              />
              <button
                type="button"
                onClick={openCommandPalette}
                className="absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-[color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-foreground active:opacity-60 xl:flex"
                aria-label="Open command palette"
              >
                <Command className="size-3" />
                ⌘K
              </button>
            </div>
          </form>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={searchPlaceholder}
              onClick={() => setMobileSearchOpen(true)}
            >
              <Search className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex lg:hidden"
              aria-label="Open command palette"
              onClick={openCommandPalette}
            >
              <Command className="size-4" />
            </Button>

            {/* The bell handles its own breakpoints: direct link below md,
                latest-3 preview popover at md and up. */}
            <NotificationsBell />

            {quickTabs.length > 0 && (
              <ExpandableTabs
                tabs={quickTabs}
                onChange={onQuickTabChange}
                className="hidden shrink-0 flex-nowrap border-none shadow-none md:flex"
              />
            )}
          </div>
        </div>
      </header>

      <MobileSearchSheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen} />
    </>
  )
}
