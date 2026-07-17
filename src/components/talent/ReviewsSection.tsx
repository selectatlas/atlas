'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { formatRating } from '@/lib/reviews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RatingStars } from './RatingStars'
import type { ReviewSummary, TalentReview } from '@/types'

interface ReviewsSectionProps {
  reviews: TalentReview[]
  summary: ReviewSummary
}

const INITIAL_VISIBLE = 3

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const months = Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24 * 30)))
  if (months < 1) return 'This month'
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export function ReviewsSection({ reviews, summary }: ReviewsSectionProps) {
  const [expanded, setExpanded] = useState(false)

  if (summary.count === 0 || reviews.length === 0) return null

  const visible = expanded ? reviews : reviews.slice(0, INITIAL_VISIBLE)
  const average = formatRating(summary.average)
  const subAverages = [
    { label: 'Communication', value: summary.sub_averages.communication },
    { label: 'Reliability', value: summary.sub_averages.reliability },
    { label: 'Craft', value: summary.sub_averages.craft },
  ].filter((row): row is { label: string; value: number } => row.value !== null)

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Reviews</h2>
      <Card className="border border-border/80 p-5 shadow-none">
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <p className="text-3xl font-bold leading-none">{average}</p>
            {summary.average !== null && <RatingStars rating={summary.average} className="mt-2" />}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {summary.count} review{summary.count > 1 ? 's' : ''}
            </p>
          </div>

          <div className="min-w-[180px] flex-1 space-y-1.5">
            {([5, 4, 3, 2, 1] as const).map(rating => {
              const count = summary.breakdown[rating]
              const pct = summary.count > 0 ? Math.round((count / summary.count) * 100) : 0
              return (
                <div key={rating} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 text-muted-foreground">{rating} ★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-muted-foreground">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {subAverages.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {subAverages.map(row => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star className="size-3 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                  {formatRating(row.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 divide-y divide-border/70">
          {visible.map(review => (
            <div key={review.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-muted">
                  {review.reviewer?.avatar_url ? (
                    <Image src={review.reviewer.avatar_url} alt={review.reviewer.full_name} fill className="object-cover" sizes="32px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-muted-foreground/50">
                      {(review.reviewer?.full_name ?? 'A')[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{review.reviewer?.full_name ?? 'Atlas hirer'}</p>
                  <div className="flex items-center gap-2">
                    <RatingStars rating={review.rating} />
                    <span className="text-xs text-muted-foreground">{relativeDate(review.created_at)}</span>
                  </div>
                </div>
              </div>
              {review.project_title && (
                <p className="mt-2 text-xs font-medium text-muted-foreground">{review.project_title}</p>
              )}
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{review.body}</p>
            </div>
          ))}
        </div>

        {reviews.length > INITIAL_VISIBLE && !expanded && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setExpanded(true)}
          >
            Show all {reviews.length} reviews
          </Button>
        )}
      </Card>
    </section>
  )
}
