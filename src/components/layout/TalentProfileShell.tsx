'use client'

import { useMemo } from 'react'
import { useSetPageShell } from '@/components/layout/use-set-page-shell'

interface TalentProfileShellProps {
  name: string
  /** Breadcrumb parent; defaults to hirer search. Owners previewing their own profile come from /profile. */
  parent?: { label: string; href: string }
}

export function TalentProfileShell({ name, parent }: TalentProfileShellProps) {
  const override = useMemo(
    () => ({
      breadcrumbs: [
        { label: parent?.label ?? 'Search', href: parent?.href ?? '/search' },
        { label: name },
      ],
      hideTitle: true,
    }),
    [name, parent?.label, parent?.href],
  )

  useSetPageShell(override)
  return null
}
