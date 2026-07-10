'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { Profile, TalentSkill } from '@/types'
import { CATEGORY_LABELS } from '@/lib/skills'
import { Badge } from '@/components/ui/badge'

type TalentResult = { profile: Profile & { talent_skills: TalentSkill[] }; match_score: number }

interface LastAction {
  type: 'contact' | 'pass'
  talentId: string
  talent: Profile & { talent_skills: TalentSkill[] }
}

interface SwipeStackProps {
  results: TalentResult[]
  onContact: (talent: Profile & { talent_skills: TalentSkill[] }) => void
  onPass: (talentId: string) => void
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

export function SwipeStack({ results, onContact, onPass, onViewProfile }: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const startX = useRef(0)
  const startTime = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)

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
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setLastAction(null)
    }
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

  const rotation = dragging ? dragX * 0.08 : 0
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
          transition: dragging ? 'none' : 'transform 0.3s ease',
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
        <button
          onClick={() => { setLastAction({ type: 'pass', talentId: current.profile.id, talent: current.profile }); onPass(current.profile.id); advance() }}
          className="w-14 h-14 bg-muted border rounded-full flex items-center justify-center text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground transition-colors shadow-lg text-xl"
        >
          ✕
        </button>
        {lastAction && (
          <button
            onClick={undo}
            className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center text-amber-600 hover:bg-amber-100 transition-colors text-sm"
            title="Undo last action"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
        )}
        <button
          onClick={() => onViewProfile(current.profile.id)}
          className="w-10 h-10 bg-card border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
        <button
          onClick={() => { setLastAction({ type: 'contact', talentId: current.profile.id, talent: current.profile }); onContact(current.profile); advance() }}
          className="w-14 h-14 bg-accent hover:bg-accent/80 rounded-full flex items-center justify-center text-accent-foreground transition-colors shadow-lg text-xl"
        >
          ✓
        </button>
      </div>

      {/* Progress */}
      <div className="absolute top-3 right-3 z-20 bg-background/70 backdrop-blur-sm text-muted-foreground text-xs px-2.5 py-1 rounded-full">
        {currentIndex + 1} of {results.length} reviewed
      </div>
    </div>
  )
}

function CardContent({ result }: { result: TalentResult }) {
  const { profile, match_score } = result
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
            {profile.full_name[0]}
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
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
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
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-muted-foreground text-xs">AI match score</span>
            <span className="bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-full">
              {match_score}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
