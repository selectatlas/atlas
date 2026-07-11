'use client'

import { CalendarDays, Clock3, MapPin, Plane, ShieldCheck } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/skills'
import { getJobMeta } from '@/lib/matching'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Job } from '@/types'

type JobWithHirer = Job & { hirer?: { full_name: string } | null }

interface JobBriefDialogProps {
  job: JobWithHirer | null
  matchReasons: string[]
  applied: boolean
  onClose: () => void
  onApply: () => void
}

export function JobBriefDialog({ job, matchReasons, applied, onClose, onApply }: JobBriefDialogProps) {
  const meta = job ? getJobMeta(job) : null

  return (
    <Dialog open={Boolean(job)} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-h-[min(720px,calc(100vh-2rem))] max-w-2xl overflow-y-auto">
        {job && meta && (
          <>
            <DialogHeader className="pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{CATEGORY_LABELS[job.category]}</Badge>
                {meta.workTypeLabel && <Badge variant="secondary">{meta.workTypeLabel}</Badge>}
              </div>
              <DialogTitle className="text-xl">{job.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">Posted by {job.hirer?.full_name ?? 'Creative team'}</p>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetaItem icon={MapPin} label="Location" value={job.location} />
                {meta.dateLabel && <MetaItem icon={CalendarDays} label="Dates" value={meta.dateLabel} />}
                {job.duration && <MetaItem icon={Clock3} label="Duration" value={job.duration} />}
                {job.budget && <MetaItem icon={ShieldCheck} label="Rate" value={job.budget} />}
              </div>

              {matchReasons.length > 0 && (
                <Card className="border-primary/20 bg-primary/5 p-4 shadow-none">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Why this fits you</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {matchReasons.map(reason => <Badge key={reason} variant="secondary">{reason}</Badge>)}
                  </div>
                </Card>
              )}

              <section>
                <h3 className="text-sm font-semibold">The brief</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{job.description}</p>
              </section>

              {job.skills_required.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">What they are looking for</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {job.skills_required.map(skill => <Badge key={skill} variant="outline">{skill}</Badge>)}
                  </div>
                </section>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {job.usage_rights && <MetaItem icon={ShieldCheck} label="Usage" value={job.usage_rights} />}
                {job.travel_required !== null && job.travel_required !== undefined && (
                  <MetaItem icon={Plane} label="Travel" value={job.travel_required ? 'Travel may be required' : 'No travel expected'} />
                )}
                {meta.deadlineLabel && <MetaItem icon={CalendarDays} label="Apply by" value={meta.deadlineLabel} />}
              </div>

              <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">You can review and edit your application before it is sent.</p>
                <Button onClick={onApply} disabled={applied} className="rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent/80">
                  {applied ? 'Already applied' : 'Apply to this job'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetaItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
