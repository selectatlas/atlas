import NextImage from 'next/image'
import { ImageIcon, Link2, Play } from 'lucide-react'
import type { PortfolioItem } from '@/types'
import { Card } from '@/components/ui/card'

interface PortfolioGalleryProps {
  items: PortfolioItem[]
}

const typeIcon = {
  video: Play,
  image: ImageIcon,
  link: Link2,
}

export function PortfolioGallery({ items }: PortfolioGalleryProps) {
  if (items.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Portfolio</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {items.map(item => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-[180px] hover:shadow-md transition-shadow group"
          >
            <Card className="overflow-hidden border-border">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted">
                {item.thumbnail_url ? (
                  <NextImage
                    src={item.thumbnail_url}
                    alt={item.title ?? ''}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="180px"
                  />
                ) : item.type === 'video' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center group-hover:bg-primary transition-colors">
                      <Play className="ml-0.5 size-4 text-primary-foreground" fill="currentColor" />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl text-muted-foreground/30">
                    {(() => {
                      const Icon = typeIcon[item.type]
                      return <Icon className="size-6" strokeWidth={1.7} />
                    })()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs font-medium line-clamp-1">
                  {item.title || (item.type === 'video' ? 'Video' : item.type === 'image' ? 'Photo' : 'Link')}
                </p>
                {item.description && (
                  <p className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">{item.description}</p>
                )}
              </div>
            </Card>
          </a>
        ))}
      </div>
    </div>
  )
}
