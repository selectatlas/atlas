'use client'

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Briefcase, Search, type LucideIcon } from 'lucide-react'
import { PageBreadcrumbs } from '@/components/layout/PageBreadcrumbs'
import { NotificationsBell } from '@/components/layout/NotificationsBell'
import { useAppShell } from '@/components/layout/app-shell-context'
import { useInbox } from '@/components/layout/inbox-context'
import { useSearch } from '@/components/search/search-context'
import { getPageMeta } from '@/lib/page-meta'
import { scopeTriggerLabel } from '@/lib/search-scope'
import { Button } from '@/components/ui/button'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'
import { Skeleton } from '@/components/ui/skeleton'

type QuickTab =
  | { title: string; icon: LucideIcon; href: string; badge?: number }
  | { type: 'separator' }

// Notifications live in the bell (mobile: direct link, md+: preview popover),
// so the quick tabs only carry destinations without their own entry point.
const hirerQuickTabs: QuickTab[] = [
  { title: 'Jobs', icon: Briefcase, href: '/my-jobs' },
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
  const { scope, setOpen } = useSearch()

  const meta = useMemo(() => {
    const base = getPageMeta(pathname, accountType)
    if (!override) return base

    return {
      ...base,
      ...override,
      breadcrumbs: override.breadcrumbs ?? base.breadcrumbs,
    }
  }, [pathname, accountType, override])

  // The top bar no longer owns a search input: it is a trigger for the one
  // search surface (SearchCommand), which owns the query, scope and results.
  const searchLabel = scopeTriggerLabel(scope)

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

          {/* Styled as an input but is a button: one search surface, opened
              here or with ⌘K, never a second place to type. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hidden min-w-0 flex-1 max-w-sm items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-[color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-ring/40 hover:text-foreground lg:flex xl:max-w-md"
            aria-label={searchLabel}
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">{searchLabel}</span>
            <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] xl:flex">
              ⌘K
            </kbd>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={searchLabel}
              onClick={() => setOpen(true)}
            >
              <Search className="size-4" />
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
    </>
  )
}
