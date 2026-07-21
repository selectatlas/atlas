'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { nameInitial } from '@/lib/display'

interface TalentCardMediaProps {
  images: string[]
  name: string
  /**
   * Chips and actions layered over the photo. Rendered inside the image box
   * (not the thumbnail strip) so `absolute` positioning stays predictable,
   * and above the tap zones so overlay buttons stay clickable.
   */
  overlay?: ReactNode
}

// Card image area with an inline carousel (client feedback 20 Jul 2026):
// hirers preview a talent's images without opening the profile.
//
// Two ways to move: tapping either half of the photo steps back/forward
// (the phone gesture - investors demo on phones), or tapping a thumbnail
// jumps straight to that image. Only the active image is fetched at card
// size; the strip requests 72px thumbnails, so a 48-card grid stays cheap.
export function TalentCardMedia({ images, name, overlay }: TalentCardMediaProps) {
  const [index, setIndex] = useState(0)
  const count = images.length
  const current = images[Math.min(index, Math.max(0, count - 1))]

  // The whole card is a link - carousel controls must not navigate.
  const stop = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const step = (delta: number) => (event: React.MouseEvent) => {
    stop(event)
    setIndex(previous => (previous + delta + count) % count)
  }

  const jump = (to: number) => (event: React.MouseEvent) => {
    stop(event)
    setIndex(to)
  }

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {current ? (
          <Image
            key={current}
            src={current}
            alt={count > 1 ? `${name}, photo ${index + 1} of ${count}` : name}
            fill
            className="object-cover object-top transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-5xl font-semibold text-muted-foreground/40">
            {nameInitial(name)}
          </div>
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={step(-1)}
              className="absolute inset-y-0 left-0 z-10 flex w-1/2 cursor-pointer items-center justify-start pl-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-7 rounded-full bg-background/80 p-1.5 text-foreground shadow-sm backdrop-blur-sm transition-opacity duration-[var(--duration-fast)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={step(1)}
              className="absolute inset-y-0 right-0 z-10 flex w-1/2 cursor-pointer items-center justify-end pr-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronRight className="size-7 rounded-full bg-background/80 p-1.5 text-foreground shadow-sm backdrop-blur-sm transition-opacity duration-[var(--duration-fast)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" />
            </button>
            <span className="sr-only" role="status" aria-live="polite">
              {`Photo ${index + 1} of ${count}`}
            </span>
          </>
        )}

        {/* Transparent to clicks so the tap zones underneath still work.
            Interactive overlay children must opt back in with
            `pointer-events-auto`; chips and labels stay inert. */}
        {overlay && (
          <div className="pointer-events-none absolute inset-0 z-20">{overlay}</div>
        )}
      </div>

      {count > 1 && (
        <div className="flex gap-1 bg-muted/60 p-2">
          {images.map((image, thumb) => (
            <button
              key={image}
              type="button"
              aria-label={`Show photo ${thumb + 1} of ${count}`}
              aria-current={thumb === index}
              onClick={jump(thumb)}
              className={`relative h-10 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-sm border transition-[opacity,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                thumb === index
                  ? 'border-primary opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <Image src={image} alt="" fill className="object-cover object-top" sizes="72px" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
