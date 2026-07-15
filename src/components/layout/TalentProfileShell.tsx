'use client'

import { useMemo } from 'react'
import { useSetPageShell } from '@/components/layout/use-set-page-shell'

export function TalentProfileShell({ name }: { name: string }) {
  const override = useMemo(
    () => ({
      breadcrumbs: [{ label: 'Search', href: '/search' }, { label: name }],
      hideTitle: true,
    }),
    [name],
  )

  useSetPageShell(override)
  return null
}
