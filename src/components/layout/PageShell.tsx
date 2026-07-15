'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAppShell } from '@/components/layout/app-shell-context'
import { getPageMeta } from '@/lib/page-meta'

type PageShellProps = {
  eyebrow?: string
  title?: string
  description?: string
  actions?: React.ReactNode
  hideTitle?: boolean
  compact?: boolean
}

/** Renders the standard page title block below AppTopBar. Omit on pages that hide the title (e.g. search, thread). */
export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  hideTitle,
  compact,
}: PageShellProps) {
  const pathname = usePathname()
  const { accountType, override } = useAppShell()

  const meta = useMemo(() => {
    const base = getPageMeta(pathname, accountType)
    const merged = override ? { ...base, ...override, breadcrumbs: override.breadcrumbs ?? base.breadcrumbs } : base
    return {
      eyebrow: eyebrow ?? merged.eyebrow,
      title: title ?? merged.title,
      description: description ?? merged.description,
      actions: actions ?? override?.actions,
      hideTitle: hideTitle ?? override?.hideTitle,
    }
  }, [pathname, accountType, override, eyebrow, title, description, actions, hideTitle])

  if (meta.hideTitle) return null

  return (
    <PageHeader
      eyebrow={meta.eyebrow}
      title={meta.title}
      description={meta.description}
      actions={meta.actions}
      compact={compact}
    />
  )
}
