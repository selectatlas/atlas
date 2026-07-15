'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PageBreadcrumbItem } from '@/components/layout/PageBreadcrumbs'

export type PageShellOverride = {
  breadcrumbs?: PageBreadcrumbItem[]
  breadcrumbsLoading?: boolean
  eyebrow?: string
  title?: string
  description?: string
  actions?: ReactNode
  hideTitle?: boolean
}

type AppShellContextValue = {
  accountType: 'hirer' | 'talent'
  isPlatformAdmin: boolean
  override: PageShellOverride | null
  setOverride: (override: PageShellOverride | null) => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

export function AppShellProvider({
  accountType,
  isPlatformAdmin = false,
  children,
}: {
  accountType: 'hirer' | 'talent'
  isPlatformAdmin?: boolean
  children: ReactNode
}) {
  const [override, setOverrideState] = useState<PageShellOverride | null>(null)

  const setOverride = useCallback((next: PageShellOverride | null) => {
    setOverrideState(next)
  }, [])

  const value = useMemo(
    () => ({ accountType, isPlatformAdmin, override, setOverride }),
    [accountType, isPlatformAdmin, override, setOverride],
  )

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell must be used within AppShellProvider')
  return ctx
}
