'use client'

import { CheckCircle2, Send } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { Job, Profile, TalentSkill } from '@/types'

type JobWithHirer = Job & { hirer?: { full_name: string } | null }

interface ApplicationPreviewDialogProps {
  job: JobWithHirer | null
  profile: (Profile & { talent_skills: TalentSkill[] }) | null
  note: string
  submitting: boolean
  error: string | null
  onNoteChange: (note: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function ApplicationPreviewDialog({ job, profile, note, submitting, error, onNoteChange, onClose, onConfirm }: ApplicationPreviewDialogProps) {
  return (
    <Dialog open={Boolean(job)} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        {job && profile && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle>Review your application</DialogTitle>
              <p className="text-sm text-muted-foreground">Applying for {job.title} with {job.hirer?.full_name ?? 'the creative team'}.</p>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/50 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{profile.full_name[0]}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{profile.full_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{profile.headline || `${CATEGORY_LABELS[profile.talent_skills[0]?.category ?? 'dancer']} talent`}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Your current profile, skills, and work evidence will be visible to the hirer.</p>
                </div>
              </div>

              <div>
                <label htmlFor="application-note" className="text-sm font-semibold">Short note <span className="font-normal text-muted-foreground">(optional)</span></label>
                <Textarea
                  id="application-note"
                  value={note}
                  onChange={event => onNoteChange(event.target.value)}
                  rows={5}
                  maxLength={1000}
                  className="mt-2 resize-none rounded-xl"
                  placeholder="Tell the hirer why this opportunity is a good fit..."
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">{note.length}/1000</p>
              </div>

              {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

              <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={onClose} disabled={submitting}>Keep reviewing</Button>
                <Button onClick={onConfirm} disabled={submitting} className="gap-2 rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent/80">
                  <Send className="size-4" />
                  {submitting ? 'Sending application...' : 'Send application'}
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-600" /> You can track the outcome from Activity.</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
