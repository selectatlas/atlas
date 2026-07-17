import Image from 'next/image'
import { Camera, Clapperboard, Megaphone, Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveCoverUrl } from '@/lib/job-cover'
import type { Category } from '@/types'

// Category-tinted gradient shown whenever a job has no cover image, so the
// card grid stays visual even for jobs posted without artwork.
const FALLBACK_STYLES: Record<Category, { gradient: string; icon: typeof Camera }> = {
  dancer: { gradient: 'from-fuchsia-500/30 via-purple-500/20 to-primary/10', icon: Music2 },
  actor: { gradient: 'from-amber-500/30 via-orange-500/20 to-primary/10', icon: Clapperboard },
  photographer_videographer: { gradient: 'from-sky-500/30 via-cyan-500/20 to-primary/10', icon: Camera },
  content_creator: { gradient: 'from-emerald-500/30 via-teal-500/20 to-primary/10', icon: Megaphone },
}

interface JobCoverProps {
  coverUrl: string | null | undefined
  category: Category
  title: string
  sizes: string
  className?: string
  children?: React.ReactNode
}

export function JobCover({ coverUrl, category, title, sizes, className, children }: JobCoverProps) {
  const fallback = FALLBACK_STYLES[category]
  const FallbackIcon = fallback.icon
  // cover_url is hirer-writable via RLS, so an arbitrary value must degrade
  // to the gradient instead of crashing next/image for every viewer.
  const src = resolveCoverUrl(coverUrl)
  return (
    <div className={cn('relative w-full overflow-hidden bg-muted', className)}>
      {src ? (
        <Image
          src={src}
          alt={`Cover for ${title}`}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-300 group-hover/job:scale-[1.03]"
        />
      ) : (
        <div className={cn('flex size-full items-center justify-center bg-gradient-to-br', fallback.gradient)}>
          <FallbackIcon className="size-10 text-foreground/25" strokeWidth={1.5} />
        </div>
      )}
      {children}
    </div>
  )
}
