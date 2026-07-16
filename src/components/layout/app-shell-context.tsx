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

type SetOverrideFn = (override: PageShellOverride | null) => void

type AppShellContextValue = {
  accountType: 'hirer' | 'talent'
  isPlatformAdmin: boolean
  override: PageShellOverride | null
  setOverride: SetOverrideFn
}

const AppShellContext = createContext<AppShellContextValue | null>(null)
// The setter lives in its own context so pages that only set the override
// (useSetPageShell) don't re-render — and re-set — every time the override
// changes, which would loop when the override is an inline object literal.
const SetOverrideContext = createContext<SetOverrideFn | null>(null)

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

  return (
    <SetOverrideContext.Provider value={setOverride}>
      <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
    </SetOverrideContext.Provider>
  )
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell must be used within AppShellProvider')
  return ctx
}

export function useSetShellOverride() {
  const setOverride = useContext(SetOverrideContext)
  if (!setOverride) throw new Error('useSetShellOverride must be used within AppShellProvider')
  return setOverride
}
