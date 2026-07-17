'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Bookmark,
  BriefcaseBusiness,
  Compass,
  Flag,
  Home,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings,
  UserRound,
  Users,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

interface NavLink {
  href: string
  label: string
}

interface NavbarProps {
  links: NavLink[]
  bottomLinks?: NavLink[]
  primaryAction?: NavLink
  badgeCounts?: Record<string, number>
  accountSwitcher?: React.ReactNode
}

const iconByHref: Record<string, typeof Search> = {
  '/home': Home,
  '/search': Search,
  '/discover': Compass,
  '/shortlists': Bookmark,
  '/activity': Activity,
  '/my-jobs': BriefcaseBusiness,
  '/messages': MessageSquare,
  '/outreach': Send,
  '/profile': UserRound,
  '/settings': Settings,
  '/admin': LayoutGrid,
  '/admin/reports': Flag,
  '/admin/users': Users,
  '/admin/jobs': BriefcaseBusiness,
  '/admin/talent': UserRound,
}

export function Navbar({ links, bottomLinks = [], primaryAction, badgeCounts = {}, accountSwitcher }: NavbarProps) {
  const pathname = usePathname()

  // Move the active highlight the moment a link is clicked, instead of
  // waiting for the navigation to commit. Cleared via the render-time
  // "derived state reset" pattern once the pathname actually changes.
  const [optimistic, setOptimistic] = useState<{ href: string; from: string } | null>(null)
  if (optimistic && optimistic.from !== pathname) setOptimistic(null)
  const activePath = optimistic?.href ?? pathname

  const isActive = (href: string) => activePath === href || activePath.startsWith(href + '/')

  const renderLink = ({ href, label }: NavLink, mobile = false) => {
    const active = isActive(href)
    const Icon = iconByHref[href] ?? LayoutGrid
    const badge = badgeCounts[href] ?? 0

    return (
      <Link
        key={href}
        href={href}
        prefetch={true}
        onClick={() => setOptimistic({ href, from: pathname })}
        aria-current={active ? 'page' : undefined}
        title={mobile ? label : undefined}
        className={mobile
          ? `relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-[color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
              active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`
          : `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98] ${
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground'
            }`
        }
      >
        <span className="relative">
          <Icon className={mobile ? 'size-4' : 'size-[17px]'} strokeWidth={active ? 2.2 : 1.8} />
          {badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        <span className={mobile ? 'truncate' : ''}>{label}</span>
        {!mobile && active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
      </Link>
    )
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground">
            <Image src="/brand/atlas-mark.svg" alt="Atlas" width={28} height={28} className="rounded-lg" />
            Atlas
          </Link>
        </div>

        <div className="flex flex-1 flex-col px-3 py-5">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="mb-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-[transform,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-primary/90 active:scale-[0.98]"
            >
              <Plus className="size-4" />
              {primaryAction.label}
            </Link>
          )}

          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
          <nav className="space-y-1" aria-label="Main navigation">
            {links.map(link => renderLink(link))}
          </nav>
        </div>

        <div className="border-t border-sidebar-border p-3">
          {accountSwitcher && (
            <div className="mb-3 border-b border-sidebar-border pb-3">{accountSwitcher}</div>
          )}
          {bottomLinks.length > 0 && (
            <nav className="mb-3 space-y-1 border-b border-sidebar-border pb-3" aria-label="Account navigation">
              {bottomLinks.map(link => renderLink(link))}
            </nav>
          )}
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
            >
              <LogOut className="size-[17px]" strokeWidth={1.8} />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-background/95 px-4 backdrop-blur-md md:hidden">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Image src="/brand/atlas-mark.svg" alt="Atlas" width={24} height={24} className="rounded-md" />
          Atlas
        </Link>
        <div className="flex items-center gap-1">
          {accountSwitcher && <div className="mr-1 w-40">{accountSwitcher}</div>}
          {bottomLinks.map(link => {
            const Icon = iconByHref[link.href] ?? LayoutGrid
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                onClick={() => setOptimistic({ href: link.href, from: pathname })}
                title={link.label}
                aria-label={link.label}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg p-2 transition-colors ${
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
              </Link>
            )
          })}
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-sidebar-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md md:hidden" aria-label="Mobile navigation">
        {links.slice(0, 5).map(link => renderLink(link, true))}
      </nav>
    </>
  )
}
