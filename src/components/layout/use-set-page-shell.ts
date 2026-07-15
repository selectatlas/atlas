'use client'

import { useEffect } from 'react'
import { useAppShell, type PageShellOverride } from '@/components/layout/app-shell-context'

export function useSetPageShell(override: PageShellOverride | null) {
  const { setOverride } = useAppShell()

  useEffect(() => {
    setOverride(override)
    return () => setOverride(null)
  }, [override, setOverride])
}
