'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RatingStars } from './RatingStars'

const SUB_RATINGS = [
  { key: 'rating_communication', label: 'Communication' },
  { key: 'rating_reliability', label: 'Reliability' },
  { key: 'rating_craft', label: 'Craft' },
] as const

type SubRatingKey = (typeof SUB_RATINGS)[number]['key']

const EMPTY_SUB_RATINGS: Record<SubRatingKey, number> = {
  rating_communication: 0,
  rating_reliability: 0,
  rating_craft: 0,
}

interface ReviewDialogProps {
  talentId: string
  talentName: string
}

// Two-stage review authoring: a private 0-10 recommend score first, then the
// public review (overall stars, optional sub-ratings, body). Only mounted for
// hirers with a hired application with this talent; the API and RLS enforce
// the same eligibility server-side.
export function ReviewDialog({ talentId, talentName }: ReviewDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [recommendScore, setRecommendScore] = useState<number | null>(null)
  const [rating, setRating] = useState(0)
  const [subRatings, setSubRatings] = useState<Record<SubRatingKey, number>>(EMPTY_SUB_RATINGS)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setStep(1)
  }

  async function handleSubmit() {
    if (rating === 0 || !body.trim() || recommendScore === null || submitting) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talent_id: talentId,
          rating,
          recommend_score: recommendScore,
          body: body.trim(),
          rating_communication: subRatings.rating_communication || null,
          rating_reliability: subRatings.rating_reliability || null,
          rating_craft: subRatings.rating_craft || null,
        }),
      })
      const data = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error ?? 'Unable to publish review')
      toast.success('Review published. Thanks for closing the loop.')
      setOpen(false)
      setStep(1)
      setRecommendScore(null)
      setRating(0)
      setSubRatings(EMPTY_SUB_RATINGS)
      setBody('')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to publish review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={() => handleOpenChange(true)}>
        <PenLine className="size-3.5" />
        Leave a review
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(640px,calc(100vh-2rem))] overflow-y-auto sm:max-w-md">
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>How did it go with {talentName}?</DialogTitle>
                <DialogDescription>Step 1 of 2. Just between you and Atlas.</DialogDescription>
              </DialogHeader>

              <div>
                <p className="text-sm font-medium">How likely are you to book {talentName} again?</p>
                <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11">
                  {Array.from({ length: 11 }, (_, score) => (
                    <button
                      key={score}
                      type="button"
                      aria-pressed={recommendScore === score}
                      onClick={() => setRecommendScore(score)}
                      className={`flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                        recommendScore === score
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/80 bg-muted/40 hover:border-primary/40'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                  <span>Not likely</span>
                  <span>Extremely likely</span>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3 shrink-0" />
                  Private. This score is never shown on the profile.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={recommendScore === null} onClick={() => setStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Write your public review</DialogTitle>
                <DialogDescription>
                  Step 2 of 2. This appears on the profile for other hirers.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Overall rating</p>
                  <RatingStars rating={rating} onRatingChange={setRating} />
                </div>

                <div className="space-y-1 rounded-xl border border-border/80 p-3">
                  {SUB_RATINGS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <RatingStars
                        rating={subRatings[key]}
                        onRatingChange={value => setSubRatings(prev => ({ ...prev, [key]: value }))}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review-body">Your review</Label>
                  <Textarea
                    id="review-body"
                    value={body}
                    onChange={event => setBody(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder={`What was it like working with ${talentName}?`}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={rating === 0 || !body.trim() || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Publishing…' : 'Publish review'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
