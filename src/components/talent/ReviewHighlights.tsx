import { Quote } from 'lucide-react'
import { pickHighlights } from '@/lib/reviews'
import { Card } from '@/components/ui/card'
import { RatingStars } from './RatingStars'
import type { TalentReview } from '@/types'

interface ReviewHighlightsProps {
  reviews: TalentReview[]
}

export function ReviewHighlights({ reviews }: ReviewHighlightsProps) {
  const highlights = pickHighlights(reviews, 2)
  if (highlights.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">What hirers loved</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {highlights.map(review => (
          <Card key={review.id} className="border border-border/80 p-4 shadow-none">
            <Quote className="mb-2 size-4 text-primary/50" fill="currentColor" strokeWidth={0} />
            <p className="text-sm leading-relaxed">{review.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RatingStars rating={review.rating} />
              <span className="text-xs font-medium">{review.reviewer?.full_name ?? 'Atlas hirer'}</span>
              {review.project_title && (
                <span className="text-xs text-muted-foreground">· {review.project_title}</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
