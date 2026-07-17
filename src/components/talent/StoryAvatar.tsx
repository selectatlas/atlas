'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import type { ProfileStory } from '@/lib/stories'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface StoryAvatarProps {
  avatarUrl: string | null
  name: string
  stories: ProfileStory[]
}

function AvatarMedia({ avatarUrl, name, sizes }: { avatarUrl: string | null; name: string; sizes: string }) {
  if (avatarUrl) {
    return <Image src={avatarUrl} alt={name} fill className="object-cover" sizes={sizes} />
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-muted-foreground/30">
      {name[0]}
    </div>
  )
}

/**
 * Profile avatar with an Instagram-style story ring. When the talent has
 * portfolio media, the avatar gets a gradient ring and tapping it opens a
 * fullscreen story viewer: auto-advancing photos and muted autoplay videos
 * with per-story progress bars, tap left/right to navigate.
 */
export function StoryAvatar({ avatarUrl, name, stories }: StoryAvatarProps) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  // Bumped on every manual navigation so the timer effect restarts even when
  // the index doesn't change (e.g. tapping back on the first story).
  const [cycle, setCycle] = useState(0)

  const closeViewer = () => {
    setOpen(false)
    setIndex(0)
    setProgress(0)
  }

  const goNext = () => {
    if (index >= stories.length - 1) {
      closeViewer()
      return
    }
    setProgress(0)
    setCycle(c => c + 1)
    setIndex(index + 1)
  }

  const goPrev = () => {
    setProgress(0)
    setCycle(c => c + 1)
    setIndex(Math.max(0, index - 1))
  }

  useEffect(() => {
    if (!open) return
    const story = stories[index]
    if (!story) return
    const startedAt = performance.now()
    const tick = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      if (elapsed >= story.durationMs) {
        window.clearInterval(tick)
        setProgress(0)
        if (index < stories.length - 1) {
          setIndex(index + 1)
        } else {
          setOpen(false)
          setIndex(0)
        }
      } else {
        setProgress(elapsed / story.durationMs)
      }
    }, 50)
    return () => window.clearInterval(tick)
  }, [open, index, cycle, stories])

  if (stories.length === 0) {
    return (
      <div className="relative w-[132px] h-[132px] sm:w-[176px] sm:h-[176px] rounded-2xl overflow-hidden bg-muted border-4 border-background shrink-0 shadow-lg">
        <AvatarMedia avatarUrl={avatarUrl} name={name} sizes="(max-width: 640px) 132px, 176px" />
      </div>
    )
  }

  const story = stories[index]

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setProgress(0)
          setCycle(c => c + 1)
          setIndex(0)
          setOpen(true)
        }}
        aria-label={`View ${name}'s stories`}
        className="group shrink-0 rounded-[22px] bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[3px] shadow-lg"
      >
        <span className="block rounded-[19px] bg-background p-[2px]">
          <span className="relative block h-[122px] w-[122px] overflow-hidden rounded-2xl bg-muted transition-transform duration-200 group-active:scale-[0.97] sm:h-[166px] sm:w-[166px]">
            <AvatarMedia avatarUrl={avatarUrl} name={name} sizes="(max-width: 640px) 122px, 166px" />
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={o => { if (!o) closeViewer() }}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 block h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none bg-black p-0 ring-0 sm:top-1/2 sm:left-1/2 sm:h-[min(85dvh,720px)] sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <DialogTitle className="sr-only">{name} stories</DialogTitle>

          {story && (
            <div className="relative h-full w-full">
              {story.kind === 'image' ? (
                <Image
                  key={`${story.id}-${cycle}`}
                  src={story.src}
                  alt={story.title ?? `${name} portfolio photo`}
                  fill
                  className="object-contain"
                  sizes="(min-width: 640px) 384px, 100vw"
                  priority
                />
              ) : (
                <iframe
                  key={`${story.id}-${cycle}`}
                  src={story.src}
                  title={story.title ?? `${name} portfolio video`}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}

              {/* Tap zones: left third goes back, right two-thirds advances */}
              <button
                type="button"
                aria-label="Previous story"
                onClick={goPrev}
                className="absolute inset-y-0 left-0 z-10 w-1/3"
              />
              <button
                type="button"
                aria-label="Next story"
                onClick={goNext}
                className="absolute inset-y-0 right-0 z-10 w-2/3"
              />

              {/* Top chrome: progress bars + name */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-3 pb-10">
                <div className="flex gap-1">
                  {stories.map((s, i) => (
                    <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm font-semibold text-white drop-shadow">{name}</p>
              </div>

              <button
                type="button"
                aria-label="Close stories"
                onClick={closeViewer}
                className="absolute top-3 right-3 z-30 flex size-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
              >
                <X className="size-5" />
              </button>

              {story.title && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
                  <p className="text-sm font-medium text-white drop-shadow">{story.title}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
