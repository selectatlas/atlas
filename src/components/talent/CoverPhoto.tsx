import Image from 'next/image'
import type { CoverLayout } from '@/types'

interface CoverPhotoProps {
  coverUrl: string | null
  /** Backs the grid layout. Ignored when layout is 'single'. */
  coverImages?: string[] | null
  layout?: CoverLayout | null
  children: React.ReactNode
}

// A grid needs all three tiles to read as deliberate; with fewer, the single
// wide cover looks better than a gappy row, so fall back rather than render a
// half-built grid.
const GRID_TILES = 3

export function CoverPhoto({ coverUrl, coverImages, layout, children }: CoverPhotoProps) {
  const images = (coverImages ?? []).filter(Boolean).slice(0, GRID_TILES)
  const useGrid = layout === 'grid' && images.length === GRID_TILES

  return (
    <div className="relative w-full">
      {/* Cover image */}
      <div className="relative w-full aspect-[3/1] bg-muted rounded-b-2xl overflow-hidden">
        {useGrid ? (
          <div className="grid size-full grid-cols-3 gap-0.5">
            {images.map((image, index) => (
              <div key={image} className="relative overflow-hidden bg-muted">
                <Image
                  src={image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, 224px"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        ) : coverUrl ? (
          <Image
            src={coverUrl}
            alt="Cover"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 672px"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted to-secondary/30" />
        )}
        {/* Bottom gradient fade for readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Overlapping content (profile photo, name, etc.) */}
      <div className="relative -mt-16 sm:-mt-24 px-4">
        {children}
      </div>
    </div>
  )
}
