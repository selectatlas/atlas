'use client'

import { type KeyboardEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'

const PLACEHOLDER = 'e.g. 3 female contemporary dancers for a London music video shoot, first week of September, £350/day'

export interface JobDraftComposerProps {
  // Owned by the page so a failed draft never loses what the hirer typed.
  brief: string
  onBriefChange: (brief: string) => void
  onDraft: (brief: string) => void
  drafting: boolean
  error: string | null
  onManual: () => void
}

// The default way into posting a job: one sentence, then AI writes the brief.
// The manual form stays one click away for hirers who would rather type it.
export function JobDraftComposer({ brief, onBriefChange, onDraft, drafting, error, onManual }: JobDraftComposerProps) {
  const canDraft = brief.trim().length > 0 && !drafting

  function submit() {
    if (canDraft) onDraft(brief.trim())
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Describe who you need in a sentence or two
            </h2>
            <p className="text-muted-foreground text-sm">
              Atlas turns it into a full job post. You review and edit everything before it goes live.
            </p>
          </div>

          {drafting ? (
            <div
              role="status"
              aria-live="polite"
              className="bg-muted flex min-h-[112px] items-center gap-3 rounded-2xl border p-4"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="bg-primary size-2 animate-bounce rounded-full"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-muted-foreground text-sm">Drafting your brief...</span>
            </div>
          ) : (
            <Textarea
              aria-label="Describe who you need"
              className="min-h-[112px] resize-none text-base"
              placeholder={PLACEHOLDER}
              value={brief}
              onChange={e => onBriefChange(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
          )}

          {error && (
            <p className="text-destructive border-destructive/20 bg-destructive/10 rounded-xl border px-4 py-3 text-sm">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={onManual}
            >
              Fill it in manually
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={!canDraft}
              className="bg-accent text-accent-foreground hover:bg-accent/80 h-12 rounded-2xl px-6 font-semibold"
            >
              <Sparkles className="size-4" />
              {drafting ? 'Drafting...' : 'Draft with AI'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
