import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  eyebrow?: string
  title?: string
  description?: string
  actions?: ReactNode
  className?: string
  compact?: boolean
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  compact = false,
}: PageHeaderProps) {
  if (!title && !eyebrow && !description && !actions) return null

  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        compact && 'mb-4',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        {title && (
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        )}
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
