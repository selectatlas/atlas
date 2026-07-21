'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { nameInitial } from '@/lib/display'

interface TalentCardMediaProps {
  images: string[]
  name: string
}

// Card image area with an inline carousel (client feedback 20 Jul 2026):
// hirers preview a talent's images without opening the profile. Only the
// active image is mounted, so a 48-card grid doesn't fetch every image of
// every profile up front; the next one loads on first arrow press.
export function TalentCardMedia({ images, name }: TalentCardMediaProps) {
  const [index, setIndex] = useState(0)
  const count = images.length
  const current = images[Math.min(index, Math.max(0, count - 1))]

  const step = (delta: number) => (event: React.MouseEvent) => {
    // The whole card is a link - arrows must not navigate.
    event.preventDefault()
    event.stopPropagation()
    setIndex(previous => (previous + delta + count) % count)
  }

  return (
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
            className="absolute left-2 top-1/2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-opacity duration-[var(--duration-fast)] hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={step(1)}
            className="absolute right-2 top-1/2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-opacity duration-[var(--duration-fast)] hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
          <div
            className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1"
            role="status"
            aria-live="polite"
            aria-label={`Photo ${index + 1} of ${count}`}
          >
            {images.map((image, dot) => (
              <span
                key={image}
                className={`size-1.5 rounded-full transition-colors duration-[var(--duration-fast)] ${dot === index ? 'bg-background' : 'bg-background/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
