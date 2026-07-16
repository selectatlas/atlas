'use client'

import { useEffect } from 'react'
import { useSetShellOverride, type PageShellOverride } from '@/components/layout/app-shell-context'

export function useSetPageShell(override: PageShellOverride | null) {
  const setOverride = useSetShellOverride()

  useEffect(() => {
    setOverride(override)
    return () => setOverride(null)
  }, [override, setOverride])
}
