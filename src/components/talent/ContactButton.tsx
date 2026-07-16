'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { Button } from '@/components/ui/button'
import type { Profile, TalentSkill } from '@/types'

interface ContactButtonProps {
  talent: Profile & { talent_skills: TalentSkill[] }
  rateLabel?: string | null
  availableNow?: boolean | null
  ratingLabel?: string | null
}

export function ContactButton({ talent, rateLabel, availableNow, ratingLabel }: ContactButtonProps) {
  const [open, setOpen] = useState(false)

  const hasMeta = Boolean(rateLabel || ratingLabel)

  return (
    <>
      <div className="fixed inset-x-0 bottom-16 z-30 px-4 pb-2 md:bottom-5 md:pb-0">
        <div className="mx-auto flex max-w-[520px] items-center justify-between gap-4 rounded-xl border border-primary/20 bg-card/95 p-3.5 shadow-lg backdrop-blur-md">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {availableNow && <span className="size-2 shrink-0 rounded-full bg-emerald-500" />}
              <span className="truncate">Contact {talent.full_name.split(' ')[0]}</span>
            </p>
            {hasMeta ? (
              <p className="flex items-center gap-1 text-muted-foreground text-xs">
                {rateLabel && <span>{rateLabel}</span>}
                {rateLabel && ratingLabel && <span>·</span>}
                {ratingLabel && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="size-3 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                    {ratingLabel}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">AI-drafted outreach message</p>
            )}
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Contact
          </Button>
        </div>
      </div>

      <OutreachModal
        talent={open ? talent : null}
        onClose={() => setOpen(false)}
        onSent={() => setOpen(false)}
      />
    </>
  )
}
