'use client'

import Link from 'next/link'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSearch } from '@/components/search/search-context'
import { scopeTriggerLabel } from '@/lib/search-scope'

// Signed-out chrome for public marketplace pages. Deliberately standalone
// (Tailwind, no session providers): AppTopBar assumes the authed shell, and
// the landing header's paper aesthetic stays scoped to the landing page.
export function PublicHeader() {
  const { scope, setOpen } = useSearch()
  const searchLabel = scopeTriggerLabel(scope)

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-base font-bold tracking-tight" aria-label="Atlas home">
          atlas<span className="text-muted-foreground">.select</span>
        </Link>
        <div className="flex items-center gap-2">
          {/* Same single search surface as the authed shell, keyword-backed:
              the AI pipeline is hirer-gated and per-user quota'd, so it is
              deliberately not reachable from a signed-out page. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground sm:flex"
            aria-label={searchLabel}
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search className="size-4 shrink-0" />
            <span>{searchLabel}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={searchLabel}
            onClick={() => setOpen(true)}
          >
            <Search className="size-4" />
          </Button>
          <Button render={<Link href="/jobs" />} variant="ghost" className="rounded-xl text-sm font-medium">
            Jobs
          </Button>
          <Button render={<Link href="/talent" />} variant="ghost" className="rounded-xl text-sm font-medium">
            Talent
          </Button>
          <Button render={<Link href="/login" />} variant="ghost" className="rounded-xl text-sm font-medium">
            Sign in
          </Button>
          <Button
            render={<Link href="/signup" />}
            className="rounded-xl bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent/80"
          >
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}
