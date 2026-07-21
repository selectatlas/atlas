'use client'

import { Sparkles, Pencil, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/lib/skills'
import { formatDate } from '@/lib/matching'
import type { JobFormValues } from '@/components/jobs/JobForm'

export interface JobDraftBannerProps {
  values: JobFormValues
  onEdit: () => void
  onRegenerate: () => void
  regenerating: boolean
}

// What the model understood, as chips: the hirer can check the draft at a
// glance instead of re-reading every field they never mentioned.
function draftChips(values: JobFormValues): string[] {
  const chips: string[] = []
  if (values.category) chips.push(CATEGORY_LABELS[values.category])
  if (values.location) chips.push(values.location)
  if (values.budget) chips.push(values.budget)
  const startLabel = formatDate(values.startDate)
  if (startLabel) chips.push(`From ${startLabel}`)
  if (values.workType) {
    chips.push(values.workType === 'in_person' ? 'In person' : values.workType === 'hybrid' ? 'Hybrid' : 'Remote')
  }
  chips.push(...values.skills.slice(0, 3))
  return chips
}

// DESIGN.md "AI output as an artefact": the draft is labelled, tinted and
// carries its own actions, so it never reads as text the hirer wrote.
export function JobDraftBanner({ values, onEdit, onRegenerate, regenerating }: JobDraftBannerProps) {
  const chips = draftChips(values)

  return (
    <section
      aria-label="AI-drafted job brief"
      className="border-border/80 bg-muted/40 rounded-xl border px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="text-primary size-4 shrink-0" />
        <span className="text-muted-foreground text-xs font-medium">AI · Draft brief</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="size-3" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            <RefreshCw className="size-3" />
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map(chip => (
            <Badge key={chip} variant="secondary">{chip}</Badge>
          ))}
        </div>
      )}

      <p className="text-muted-foreground mt-2 text-xs">
        Review and edit anything below, then post.
      </p>
    </section>
  )
}
