'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, MapPin, Pause, Play } from 'lucide-react'
import posthog from 'posthog-js'
import { showcaseTalent, type ShowcaseTalent } from '@/components/marketing/landing-data'

const AUTO_SCROLL_PX_PER_SECOND = 18
const INTERACTION_PAUSE_MS = 4000

function captureRosterInteraction(interaction: string, talent?: string) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return
  posthog.capture('landing_roster_interacted', { interaction, talent })
}

function TalentCard({ talent, duplicate = false }: { talent: ShowcaseTalent; duplicate?: boolean }) {
  const content = (
    <article className="landing-roster__card">
      <div className="landing-roster__photo">
        <Image
          src={talent.image}
          alt={duplicate ? '' : `${talent.name}, ${talent.role}`}
          fill
          sizes="(max-width: 520px) 78vw, (max-width: 920px) 44vw, 280px"
        />
        <span>{talent.category}</span>
      </div>
      <div className="landing-roster__body">
        <h3>{talent.name}</h3>
        <p className="landing-roster__role">{talent.role}</p>
        <p className="landing-roster__meta">
          <MapPin aria-hidden="true" />
          {talent.city} · {talent.availability}
        </p>
        <div className="landing-roster__skills">
          {talent.skills.map(skill => <span key={skill}>{skill}</span>)}
        </div>
      </div>
    </article>
  )

  if (duplicate) return <div className="landing-roster__item" aria-hidden="true">{content}</div>

  return (
    <Link
      href="/signup?source=roster"
      className="landing-roster__item"
      onClick={() => captureRosterInteraction('card', talent.name)}
      aria-label={`Create an account to view ${talent.name}'s profile`}
    >
      {content}
    </Link>
  )
}

export function TalentCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const isHoveredRef = useRef(false)
  const hasFocusRef = useRef(false)
  const isPointerDownRef = useRef(false)
  const interactionPausedRef = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isManuallyPaused, setIsManuallyPaused] = useState(false)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const pauseTemporarily = useCallback(() => {
    interactionPausedRef.current = true
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      interactionPausedRef.current = false
    }, INTERACTION_PAUSE_MS)
  }, [])

  const moveByCard = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current
    const card = trackRef.current?.querySelector<HTMLElement>('.landing-roster__item')
    if (!viewport || !card) return

    pauseTemporarily()
    const distance = card.getBoundingClientRect().width + 16
    const loopWidth = (trackRef.current?.scrollWidth ?? 0) / 2
    if (direction < 0 && viewport.scrollLeft < distance && loopWidth > 0) {
      viewport.scrollLeft += loopWidth
    }
    viewport.scrollBy({ left: distance * direction, behavior: 'smooth' })
    captureRosterInteraction(direction > 0 ? 'next' : 'previous')
  }, [pauseTemporarily])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(reducedMotion.matches)
    setIsDocumentVisible(document.visibilityState === 'visible')

    const onVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible')
    }
    const onMotionChange = () => setPrefersReducedMotion(reducedMotion.matches)
    document.addEventListener('visibilitychange', onVisibilityChange)
    reducedMotion.addEventListener('change', onMotionChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      reducedMotion.removeEventListener('change', onMotionChange)
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track || !isDocumentVisible || prefersReducedMotion || isManuallyPaused) return

    let frame = 0
    let lastTime = 0
    let scrollPosition = viewport.scrollLeft
    const animate = (time: number) => {
      const delta = lastTime === 0 ? 0 : Math.min(time - lastTime, 50)
      lastTime = time
      const rect = viewport.getBoundingClientRect()
      const isInViewport = rect.bottom > 0 && rect.top < window.innerHeight
      const shouldMove = isInViewport
        && !isHoveredRef.current
        && !hasFocusRef.current
        && !isPointerDownRef.current
        && !interactionPausedRef.current

      if (shouldMove) {
        scrollPosition += (delta / 1000) * AUTO_SCROLL_PX_PER_SECOND
        const loopWidth = track.scrollWidth / 2
        if (loopWidth > 0 && scrollPosition >= loopWidth) scrollPosition -= loopWidth
        viewport.scrollLeft = scrollPosition
      } else {
        // Keep native swipe, wheel, and button navigation as the source of
        // truth while movement is paused, then resume without a position jump.
        scrollPosition = viewport.scrollLeft
      }
      frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [isDocumentVisible, isManuallyPaused, prefersReducedMotion])

  return (
    <div
      className="landing-roster-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured talent from the Atlas demo roster"
    >
      <div className="landing-roster-carousel__controls">
        <p>Eight seeded demo profiles</p>
        <div>
          <button type="button" onClick={() => moveByCard(-1)} aria-label="Show previous talent">
            <ArrowLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsManuallyPaused(value => !value)
              captureRosterInteraction(isManuallyPaused ? 'play' : 'pause')
            }}
            aria-label={isManuallyPaused ? 'Play talent carousel' : 'Pause talent carousel'}
            aria-pressed={isManuallyPaused}
          >
            {isManuallyPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => moveByCard(1)} aria-label="Show next talent">
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="landing-roster-carousel__viewport"
        onMouseEnter={() => { isHoveredRef.current = true }}
        onMouseLeave={() => { isHoveredRef.current = false }}
        onFocusCapture={() => { hasFocusRef.current = true }}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) hasFocusRef.current = false
        }}
        onPointerDown={() => { isPointerDownRef.current = true }}
        onPointerUp={() => {
          isPointerDownRef.current = false
          pauseTemporarily()
        }}
        onPointerCancel={() => {
          isPointerDownRef.current = false
          pauseTemporarily()
        }}
        onWheel={pauseTemporarily}
      >
        <div ref={trackRef} className="landing-roster-carousel__track">
          <div className="landing-roster-carousel__group">
            {showcaseTalent.map(talent => <TalentCard talent={talent} key={talent.name} />)}
          </div>
          <div className="landing-roster-carousel__group landing-roster-carousel__duplicate" aria-hidden="true">
            {showcaseTalent.map(talent => <TalentCard talent={talent} duplicate key={`duplicate-${talent.name}`} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
