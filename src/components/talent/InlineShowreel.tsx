import { Clapperboard } from 'lucide-react'
import { getVideoEmbedUrl } from '@/lib/video-embed'
import { Card } from '@/components/ui/card'

interface InlineShowreelProps {
  url: string
  title?: string | null
}

/**
 * Inline 16:9 player for a YouTube/Vimeo showreel.
 * Falls back to a link card when the URL is not embeddable.
 */
export function InlineShowreel({ url, title }: InlineShowreelProps) {
  const embedUrl = getVideoEmbedUrl(url)
  const heading = title || 'Showreel'

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">{heading}</h2>
      {embedUrl ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-black">
          <iframe
            src={embedUrl}
            title={heading}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Card className="flex items-center gap-3 border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clapperboard className="size-5" />
            </div>
            <span className="text-sm font-medium">Watch showreel</span>
          </Card>
        </a>
      )}
    </section>
  )
}
