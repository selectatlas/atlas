'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BriefcaseBusiness,
  Compass,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Send,
  UserRound,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'

interface NavLink {
  href: string
  label: string
}

interface NavbarProps {
  links: NavLink[]
  primaryAction?: NavLink
}

const iconByHref: Record<string, typeof Search> = {
  '/search': Search,
  '/discover': Compass,
  '/activity': Activity,
  '/jobs': BriefcaseBusiness,
  '/messages': MessageSquare,
  '/outreach': Send,
  '/profile': UserRound,
}

export function Navbar({ links, primaryAction }: NavbarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const renderLink = ({ href, label }: NavLink, mobile = false) => {
    const active = isActive(href)
    const Icon = iconByHref[href] ?? LayoutGrid

    return (
      <Link
        key={href}
        href={href}
        prefetch={true}
        aria-current={active ? 'page' : undefined}
        title={mobile ? label : undefined}
        className={mobile
          ? `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-[color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
              active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`
          : `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98] ${
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground'
            }`
        }
      >
        <Icon className={mobile ? 'size-4' : 'size-[17px]'} strokeWidth={active ? 2.2 : 1.8} />
        <span className={mobile ? 'truncate' : ''}>{label}</span>
        {!mobile && active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
      </Link>
    )
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">c</span>
            castd.ai
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
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-[color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-sidebar-accent/70 hover:text-foreground active:scale-[0.98]"
            >
              <LogOut className="size-[17px]" strokeWidth={1.8} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-background/95 px-4 backdrop-blur-md md:hidden">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">c</span>
          castd.ai
        </Link>
        <span className="text-xs font-medium text-muted-foreground">Workspace</span>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-sidebar-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md md:hidden" aria-label="Mobile navigation">
        {links.slice(0, 5).map(link => renderLink(link, true))}
      </nav>
    </>
  )
}
