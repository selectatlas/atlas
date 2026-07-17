import { Check, Medal } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  TALENT_LEVELS,
  TALENT_LEVEL_LABELS,
  getTalentLevelProgress,
  type TalentLevelMetrics,
} from '@/lib/talent-level'
import { cn } from '@/lib/utils'

interface TalentLevelPanelProps {
  metrics: TalentLevelMetrics
}

/**
 * Full progress-vs-thresholds panel for the talent's own profile editor:
 * the level ladder (New → Rising → Established → Top Rated) plus per-metric
 * progress bars toward the next level.
 */
export function TalentLevelPanel({ metrics }: TalentLevelPanelProps) {
  const { level, next, rows } = getTalentLevelProgress(metrics)
  const currentIndex = TALENT_LEVELS.indexOf(level)

  return (
    <Card className="p-5 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Talent level</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold">
            <Medal className="size-4 text-primary" />
            {TALENT_LEVEL_LABELS[level]}
          </h2>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-1" aria-label="Level ladder">
        {TALENT_LEVELS.map((step, index) => {
          const reached = index <= currentIndex
          const isCurrent = index === currentIndex
          return (
            <div key={step} className="flex flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    index === 0 ? 'bg-transparent' : reached ? 'bg-primary' : 'bg-border',
                  )}
                />
                <span
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    reached ? 'bg-primary' : 'bg-border',
                    isCurrent && 'ring-4 ring-primary/20',
                  )}
                />
                <div
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    index === TALENT_LEVELS.length - 1
                      ? 'bg-transparent'
                      : index < currentIndex
                        ? 'bg-primary'
                        : 'bg-border',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-center text-[10px] font-medium leading-tight',
                  reached ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {TALENT_LEVEL_LABELS[step]}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {next
          ? `Meet every target below to reach ${TALENT_LEVEL_LABELS[next]}.`
          : 'You are at the top of the ladder. Keep these numbers up to stay Top Rated.'}
      </p>

      <div className="mt-4 space-y-4">
        {rows.map(row => (
          <div key={row.key}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium">{row.label}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 tabular-nums',
                  row.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                )}
              >
                {row.met && <Check className="size-3" />}
                {row.current} / {row.target}
              </span>
            </div>
            <Progress
              value={Math.round(row.progress * 100)}
              aria-label={`${row.label} progress`}
              className="mt-1.5"
            />
          </div>
        ))}
      </div>
    </Card>
  )
}
