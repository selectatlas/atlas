import { Medal } from 'lucide-react'
import { TALENT_LEVEL_LABELS, type RankedTalentLevel, type TalentLevel } from '@/lib/talent-level'
import { cn } from '@/lib/utils'

const LEVEL_STYLES: Record<RankedTalentLevel, string> = {
  rising: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  established: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  top_rated: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
}

interface TalentLevelBadgeProps {
  level?: TalentLevel | null
  className?: string
}

/**
 * Compact level pill for tight rows (search cards, list items). Renders
 * nothing for talent still at the New level so result grids stay calm.
 */
export function TalentLevelBadge({ level, className }: TalentLevelBadgeProps) {
  if (!level || level === 'new') return null
  const label = TALENT_LEVEL_LABELS[level]

  return (
    <span
      title={`${label} talent on Atlas`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        LEVEL_STYLES[level],
        className,
      )}
    >
      <Medal className="size-3" strokeWidth={2.2} />
      {label}
    </span>
  )
}
