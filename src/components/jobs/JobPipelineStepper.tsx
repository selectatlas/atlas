import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PIPELINE_STEPS, pipelineStageIndex, type PipelineStage } from '@/lib/job-pipeline'

/**
 * Persistent job pipeline stepper: Post -> Review applicants -> Shortlist -> Hire.
 * Purely presentational; the current stage is derived from application statuses.
 */
export function JobPipelineStepper({ stage }: { stage: PipelineStage }) {
  const activeIndex = pipelineStageIndex(stage)

  return (
    <ol aria-label="Job pipeline" className="flex items-start">
      {PIPELINE_STEPS.map((step, index) => {
        const isDone = index < activeIndex
        const isCurrent = index === activeIndex
        return (
          <li
            key={step.stage}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex w-full items-center">
              <div
                className={cn(
                  'h-px flex-1',
                  index === 0 ? 'bg-transparent' : isDone || isCurrent ? 'bg-primary' : 'bg-border'
                )}
              />
              <div
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                  isDone && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-primary/10 text-primary',
                  !isDone && !isCurrent && 'border-border bg-muted text-muted-foreground'
                )}
              >
                {isDone ? <Check className="size-3.5" /> : index + 1}
              </div>
              <div
                className={cn(
                  'h-px flex-1',
                  index === PIPELINE_STEPS.length - 1 ? 'bg-transparent' : isDone ? 'bg-primary' : 'bg-border'
                )}
              />
            </div>
            <span
              className={cn(
                'px-1 text-center text-[11px] leading-tight font-medium',
                isCurrent ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/70'
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
