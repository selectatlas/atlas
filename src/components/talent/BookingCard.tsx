'use client'

import { useState } from 'react'
import { Bookmark, CalendarDays, Clock, MapPin, Star } from 'lucide-react'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDayRate } from '@/lib/display'
import { formatRating } from '@/lib/reviews'
import { ShortlistButton } from './ShortlistButton'
import type { Profile, ReviewSummary, TalentSkill } from '@/types'

interface BookingCardProps {
  talent: Profile & { talent_skills: TalentSkill[] }
  rateMin: number | null
  rateMax: number | null
  availableNow: boolean | null
  responseTimeHours: number | null
  summary: ReviewSummary
  shortlistCount: number
  /** Hidden in the owner's preview mode — the card stays, the CTAs go. */
  showActions?: boolean
}

export function BookingCard({
  talent,
  rateMin,
  rateMax,
  availableNow,
  responseTimeHours,
  summary,
  shortlistCount,
  showActions = true,
}: BookingCardProps) {
  const [open, setOpen] = useState(false)

  const dayRate = formatDayRate(rateMin, rateMax)
  const average = formatRating(summary.average)
  const location = [talent.city, talent.country].filter(Boolean).join(', ')

  return (
    <>
      <Card className="border border-border/80 p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            {availableNow !== null && (
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={`size-2 rounded-full ${availableNow ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                />
                {availableNow ? 'Available now' : 'Limited availability'}
              </p>
            )}
            {dayRate && <p className="mt-1.5 text-lg font-bold leading-tight">{dayRate}</p>}
          </div>
          {average && (
            <p className="flex shrink-0 items-center gap-1 text-sm font-semibold">
              <Star className="size-4 fill-amber-400 text-amber-400" strokeWidth={1.5} />
              {average}
              <span className="font-normal text-muted-foreground">({summary.count})</span>
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2.5 border-t border-border/70 pt-4">
          {location && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              {location}
            </p>
          )}
          {responseTimeHours !== null && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0 text-primary" />
              Typically responds in ~{responseTimeHours}h
            </p>
          )}
          {talent.availability && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5 shrink-0 text-primary" />
              {talent.availability}
            </p>
          )}
        </div>

        {showActions && (
          <>
            <Button
              onClick={() => setOpen(true)}
              className="mt-4 h-11 w-full rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Contact {talent.full_name.split(' ')[0]}
            </Button>

            <div className="mt-2 flex items-center justify-center gap-1">
              <ShortlistButton talentId={talent.id} />
              <span className="text-xs text-muted-foreground">Save to shortlist</span>
            </div>
          </>
        )}

        {shortlistCount > 0 && (
          <p className="mt-3 flex items-center justify-center gap-1.5 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <Bookmark className="size-3.5 text-primary" />
            Shortlisted by {shortlistCount} hirer{shortlistCount > 1 ? 's' : ''}
          </p>
        )}
      </Card>

      <OutreachModal
        talent={open ? talent : null}
        onClose={() => setOpen(false)}
        onSent={() => setOpen(false)}
      />
    </>
  )
}
