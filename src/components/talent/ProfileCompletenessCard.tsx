'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, CircleAlert, Sparkles } from 'lucide-react'
import { COMPLETENESS_STAT, getProfileCompleteness, type CompletenessProfile, type ProfileCompletenessItem } from '@/lib/profile-completeness'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TalentAttributesPayload } from '@/lib/talent-profile-attributes'

interface ProfileCompletenessCardProps {
  profile: CompletenessProfile
  attributes?: TalentAttributesPayload
  /** When set, the checklist modal shows a CTA linking to the profile editor. */
  editHref?: string
}

function CompletenessBar({ score, className }: { score: number; className?: string }) {
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-background/70', className)}
      role="progressbar"
      aria-label="Profile completeness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--duration-base)]" style={{ width: `${score}%` }} />
    </div>
  )
}

function ChecklistRow({ item }: { item: ProfileCompletenessItem }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
      {item.complete ? (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-3" />
        </span>
      ) : (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CircleAlert className="size-3" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', item.complete && 'text-muted-foreground line-through decoration-border')}>{item.label}</p>
        {!item.complete && <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>}
      </div>
      <Badge variant={item.complete ? 'secondary' : 'outline'} className="shrink-0 tabular-nums">
        {item.complete ? 'Done' : `+${item.weight}%`}
      </Badge>
    </div>
  )
}

export function ProfileCompletenessCard({ profile, attributes, editHref }: ProfileCompletenessCardProps) {
  const [open, setOpen] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const { score, missing, completed } = getProfileCompleteness(profile, attributes)
  const nextSteps = missing.slice(0, 2)

  return (
    <>
      <Card className="border-primary/20 bg-primary/5 p-5 shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Profile strength</p>
            <h2 className="mt-1 text-base font-semibold">{score}% ready to be discovered</h2>
          </div>
          <span className="text-2xl font-bold text-primary">{score}%</span>
        </div>
        <CompletenessBar score={score} className="mt-4" />
        {nextSteps.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-foreground/80">Next best updates</p>
            {nextSteps.map(item => (
              <div key={item.key} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span><strong className="font-medium text-foreground">{item.label}.</strong> {item.hint}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-xs text-emerald-700"><Check className="size-3.5" /> Your profile is ready for matching.</p>
        )}
        <Button variant="outline" size="sm" className="mt-4 w-full rounded-xl sm:w-auto" onClick={() => setOpen(true)}>
          View full checklist
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Adding photos? Read the{' '}
          <Link href="/guides/photo-guidance" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
            Photo guide
          </Link>{' '}
          so nothing gets flagged in review.
        </p>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(680px,calc(100vh-2rem))] max-w-lg overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle>Profile checklist</DialogTitle>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              {COMPLETENESS_STAT}
            </p>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{score}% complete</span>
                <span className="text-muted-foreground">{completed.length} of {completed.length + missing.length} done</span>
              </div>
              <CompletenessBar score={score} className="mt-2 bg-muted" />
            </div>

            {missing.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Still to do</p>
                {missing.map(item => <ChecklistRow key={item.key} item={item} />)}
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                <Check className="size-4 shrink-0" /> Everything is done. Your profile is ready for matching.
              </p>
            )}

            {completed.length > 0 && (
              <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
                  <span>{showCompleted ? 'Hide completed' : 'Show completed'} ({completed.length})</span>
                  <ChevronDown className={cn('size-4 transition-transform', showCompleted && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-1">
                  {completed.map(item => <ChecklistRow key={item.key} item={item} />)}
                </CollapsibleContent>
              </Collapsible>
            )}

            {editHref && missing.length > 0 && (
              <Link
                href={editHref}
                className={cn(buttonVariants(), 'w-full rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent/80')}
                onClick={() => setOpen(false)}
              >
                Complete your profile
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
