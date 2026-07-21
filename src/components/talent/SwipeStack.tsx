'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { Profile, TalentSkill, TalentSearchResult } from '@/types'
import { nameInitial } from '@/lib/display'
import { CATEGORY_LABELS } from '@/lib/skills'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Eye, MapPin, Undo2, X } from 'lucide-react'

type TalentResult = TalentSearchResult

interface LastAction {
  type: 'contact' | 'pass'
  talentId: string
  talent: Profile & { talent_skills: TalentSkill[] }
}

interface SwipeStackProps {
  results: TalentResult[]
  onContact: (talent: Profile & { talent_skills: TalentSkill[] }) => void
  onPass: (talentId: string) => void
  onUndo?: (talentId: string) => void
  onViewProfile: (talentId: string) => void
}

const SWIPE_THRESHOLD = 80
const VELOCITY_THRESHOLD = 0.3 // px/ms — dismiss if velocity exceeds this
/*
 * CRISP Gesture Craft:
 * - Dismiss on velocity OR distance (hard wall where physics should be fails S)
 * - Damping at boundaries: the more they drag past the edge, the less the card moves
 * - Pointer capture: drag continues even if pointer leaves the element bounds
 * - Multi-touch protection: ignore additional touch points after drag begins
 */

export function SwipeStack({ results, onContact, onPass, onUndo, onViewProfile }: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const startX = useRef(0)
  const startTime = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)
  const reducedMotion = useReducedMotion()

  const current = results[currentIndex]
  const next = results[currentIndex + 1]

  const advance = useCallback(() => {
    setCurrentIndex(i => i + 1)
    setDragX(0)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!current) return
      if (e.key === 'ArrowRight') {
        setLastAction({ type: 'contact', talentId: current.profile.id, talent: current.profile })
        onContact(current.profile)
        advance()
      } else if (e.key === 'ArrowLeft') {
        setLastAction({ type: 'pass', talentId: current.profile.id, talent: current.profile })
        onPass(current.profile.id)
        advance()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [current, onContact, onPass, advance])

  function undo() {
    if (!lastAction) return
    onUndo?.(lastAction.talentId)
    setCurrentIndex(i => Math.max(0, i - 1))
    setDragX(0)
    setLastAction(null)
  }

  function handleDragStart(e: React.PointerEvent) {
    /* Multi-touch protection: ignore additional touches */
    if (pointerId.current !== null) return
    pointerId.current = e.pointerId

    /* Pointer capture: drag continues even if pointer leaves the element */
    cardRef.current?.setPointerCapture(e.pointerId)

    startX.current = e.clientX
    startTime.current = e.timeStamp
    setDragging(true)
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!dragging || pointerId.current !== e.pointerId) return
    const raw = e.clientX - startX.current
    /* Damping at boundaries: the more they drag past edge, the less the card moves */
    const damped = raw > 0 ? raw : raw * 0.3
    setDragX(damped)
  }

  function handleDragEnd(e: React.PointerEvent) {
    if (!dragging || pointerId.current !== e.pointerId) return
    pointerId.current = null
    setDragging(false)

    const elapsed = e.timeStamp - startTime.current
    if (elapsed > 0) {
      const velocity = Math.abs(dragX) / elapsed

      /* Dismiss on velocity OR distance */
      if (dragX > SWIPE_THRESHOLD || (dragX > 20 && velocity > VELOCITY_THRESHOLD)) {
        setLastAction({ type: 'contact', talentId: current.profile.id, talent: current.profile })
        onContact(current.profile)
        advance()
        return
      }
      if (dragX < -SWIPE_THRESHOLD || (dragX < -20 && velocity > VELOCITY_THRESHOLD)) {
        setLastAction({ type: 'pass', talentId: current.profile.id, talent: current.profile })
        onPass(current.profile.id)
        advance()
        return
      }
    }
    setDragX(0)
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-5xl mb-4">✨</div>
        <p className="font-semibold">You&apos;ve reviewed all matches</p>
        <p className="text-muted-foreground text-sm mt-1">Try a new search to find more talent</p>
      </div>
    )
  }

  const rotation = dragging && !reducedMotion ? dragX * 0.08 : 0
  const isRight = dragX > 40
  const isLeft = dragX < -40

  return (
    <div className="relative select-none" style={{ height: 520 }}>
      {/* Next card (behind) */}
      {next && (
        <div
          className="absolute inset-0 bg-card border rounded-3xl overflow-hidden"
          style={{ transform: 'scale(0.95)', transformOrigin: 'bottom center', zIndex: 1 }}
        >
          <CardContent result={next} />
        </div>
      )}

      {/* Current card */}
      <div
        ref={cardRef}
        className="absolute inset-0 bg-card border rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing shadow-2xl"
        style={{
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          transition: dragging || reducedMotion ? 'none' : 'transform var(--duration-base) var(--ease-out)',
          zIndex: 2,
          touchAction: 'none',
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <CardContent result={current} />

        {/* Swipe indicators */}
        {isRight && (
          <div className="absolute inset-0 bg-accent/20 flex items-center justify-center rounded-3xl">
            <div className="bg-accent text-accent-foreground text-2xl font-bold px-6 py-3 rounded-2xl border-4 border-accent rotate-[-15deg]">
              CONTACT
            </div>
          </div>
        )}
        {isLeft && (
          <div className="absolute inset-0 bg-muted/60 flex items-center justify-center rounded-3xl">
            <div className="bg-muted text-muted-foreground text-2xl font-bold px-6 py-3 rounded-2xl border-4 border-border rotate-[15deg]">
              PASS
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-center gap-6 z-10">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={() => { setLastAction({ type: 'pass', talentId: current.profile.id, talent: current.profile }); onPass(current.profile.id); advance() }}
          aria-label="Pass"
          className="size-14 rounded-full bg-muted text-muted-foreground shadow-sm hover:text-foreground"
        >
          <X className="size-6" />
        </Button>
        {lastAction && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={undo}
            aria-label="Undo last action"
            title="Undo last action"
            className="size-10 rounded-full border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
          >
            <Undo2 className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onViewProfile(current.profile.id)}
          aria-label="View profile"
          className="size-10 rounded-full bg-card text-muted-foreground hover:text-foreground"
        >
          <Eye className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-lg"
          onClick={() => { setLastAction({ type: 'contact', talentId: current.profile.id, talent: current.profile }); onContact(current.profile); advance() }}
          aria-label="Contact"
          className="size-14 rounded-full bg-accent text-accent-foreground shadow-sm hover:bg-accent/80"
        >
          <Check className="size-6" />
        </Button>
      </div>

      {/* Progress */}
      <div className="absolute top-3 right-3 z-20 bg-background/70 backdrop-blur-sm text-muted-foreground text-xs px-2.5 py-1 rounded-full">
        Card {currentIndex + 1} of {results.length}
      </div>
    </div>
  )
}

function CardContent({ result }: { result: TalentResult }) {
  const { profile, match_score, match_reasons } = result
  const skills = profile.talent_skills.slice(0, 4)

  return (
    <div className="h-full flex flex-col">
      <div className="relative flex-shrink-0 aspect-[4/3] bg-muted overflow-hidden">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.full_name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 672px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-muted-foreground/30">
            {nameInitial(profile.full_name)}
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-card to-transparent" />
      </div>

      <div className="flex-1 p-6 flex flex-col">
        <div className="mb-3">
          {profile.talent_skills[0]?.category && (
            <Badge variant="secondary" className="text-xs">
              {CATEGORY_LABELS[profile.talent_skills[0].category]}
            </Badge>
          )}
        </div>

        <h2 className="text-xl font-bold leading-tight mb-1">{profile.full_name}</h2>
        {profile.headline && <p className="text-muted-foreground text-sm mb-2">{profile.headline}</p>}

        {(profile.city || profile.country) && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-4">
            <MapPin className="size-3.5" />
            {[profile.city, profile.country].filter(Boolean).join(', ')}
            {profile.rates && <span className="ml-2">{profile.rates}</span>}
          </div>
        )}

        {profile.bio && (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 flex-1">{profile.bio}</p>
        )}

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {skills.map(skill => (
              <Badge key={skill.id} variant="outline" className="text-xs">
                {skill.skill}
              </Badge>
            ))}
          </div>
        )}

        {match_score > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">AI match score</span>
              <span className="bg-brand-lime text-black text-xs font-bold px-2.5 py-1 rounded-full">
                {match_score}% match
              </span>
            </div>
            {match_reasons && match_reasons.length > 0 && (
              <div
                className="mt-2 flex flex-wrap gap-1.5"
                aria-label="Why this talent matches"
              >
                {match_reasons.slice(0, 3).map(reason => (
                  <Badge
                    key={reason}
                    variant="secondary"
                    className="max-w-full text-[11px]"
                  >
                    <span className="truncate">{reason}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
