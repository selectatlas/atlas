import { BadgeCheck } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/skills'
import type { Category } from '@/types'

interface VerifiedBadgeProps {
  verifiedAt: string | null | undefined
  categories?: Category[]
  /** Icon-only rendering for tight rows (search cards, shortlist rows). */
  compact?: boolean
  className?: string
}

export function VerifiedBadge({ verifiedAt, categories = [], compact = false, className = '' }: VerifiedBadgeProps) {
  if (!verifiedAt) return null

  const categoryLabels = categories.map(category => CATEGORY_LABELS[category]).filter(Boolean)
  const title = categoryLabels.length > 0
    ? `Atlas Verified for ${categoryLabels.join(', ')}`
    : 'Atlas Verified'

  if (compact) {
    return (
      <span
        title={title}
        className={`inline-flex shrink-0 items-center text-primary ${className}`}
      >
        <BadgeCheck className="size-3.5" strokeWidth={2.2} />
        <span className="sr-only">{title}</span>
      </span>
    )
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary ${className}`}
    >
      <BadgeCheck className="size-3.5" strokeWidth={2.2} />
      Atlas Verified
    </span>
  )
}
