'use client'

import { useEffect, useState } from 'react'
import NextImage from 'next/image'
import { CalendarDays, ExternalLink, ImageIcon, Link2, Play, TrendingUp, User } from 'lucide-react'
import type { PortfolioItem } from '@/types'
import { portfolioImageAlt } from '@/lib/display'
import { getVideoEmbedUrl } from '@/lib/video-embed'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface PortfolioGalleryProps {
  items: PortfolioItem[]
}

const typeIcon = {
  video: Play,
  image: ImageIcon,
  link: Link2,
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    // matchMedia is the external state source; hydrate once on mount, then subscribe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(query.matches)
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

function formatProjectDate(date: string | null): string | null {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
}

function ItemDetail({ item }: { item: PortfolioItem }) {
  const embedUrl = item.type === 'video' ? getVideoEmbedUrl(item.url) : null
  const projectDate = formatProjectDate(item.project_date)

  return (
    <div className="space-y-4">
      {embedUrl ? (
        <div className="overflow-hidden rounded-lg bg-black">
          <iframe
            src={embedUrl}
            title={item.title ?? 'Portfolio video'}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>
      ) : item.thumbnail_url ? (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          <NextImage
            src={item.thumbnail_url}
            alt={portfolioImageAlt(item)}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 512px, 100vw"
          />
        </div>
      ) : null}

      <div className="space-y-2.5">
        {item.role && (
          <p className="flex items-center gap-2 text-sm">
            <User className="size-4 shrink-0 text-primary" />
            {item.role}
          </p>
        )}
        {projectDate && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            {projectDate}
          </p>
        )}
        {item.outcome && (
          <p className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium">
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" />
            {item.outcome}
          </p>
        )}
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Open original
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  )
}

export function PortfolioGallery({ items }: PortfolioGalleryProps) {
  const [selected, setSelected] = useState<PortfolioItem | null>(null)
  const isDesktop = useIsDesktop()

  if (items.length === 0) return null

  const selectedTitle = selected?.title || (selected?.type === 'video' ? 'Video' : selected?.type === 'image' ? 'Photo' : 'Link')

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Portfolio</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="shrink-0 w-[180px] text-left hover:shadow-md transition-shadow group"
          >
            <Card className="overflow-hidden border-border">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted">
                {item.thumbnail_url ? (
                  <NextImage
                    src={item.thumbnail_url}
                    alt={portfolioImageAlt(item)}
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
                {(item.role || item.description) && (
                  <p className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">{item.role || item.description}</p>
                )}
              </div>
            </Card>
          </button>
        ))}
      </div>

      {isDesktop ? (
        <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}>
          <DialogContent className="sm:max-w-xl">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedTitle}</DialogTitle>
                  {selected.description && <DialogDescription>{selected.description}</DialogDescription>}
                </DialogHeader>
                <ItemDetail item={selected} />
              </>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-8">
            {selected && (
              <>
                <SheetHeader className="px-0">
                  <SheetTitle>{selectedTitle}</SheetTitle>
                  {selected.description && <SheetDescription>{selected.description}</SheetDescription>}
                </SheetHeader>
                <ItemDetail item={selected} />
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
