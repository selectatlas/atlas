'use client'

import { useEffect, useRef, useState } from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { ConversationListPane } from '@/components/messages/ConversationListPane'

/**
 * Intercom-style split shell for /messages. The conversation list lives in
 * the layout so it never remounts while navigating between threads; the
 * detail pane renders the active route segment.
 *
 * The pane height is measured at runtime (viewport minus the shell's own top
 * offset) so it adapts to the app chrome on both mobile and desktop without
 * hardcoding header heights.
 */
export function MessagesShell({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()
  const threadOpen = segment !== null
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number | null>(null)

  useEffect(() => {
    const measure = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) setTop(rect.top + window.scrollY)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div
      ref={ref}
      style={{ height: top !== null ? `calc(100dvh - ${top}px)` : '70dvh' }}
      className="-mx-4 -mb-24 flex min-h-0 overflow-hidden bg-background pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:-mx-6 md:-mx-8 md:-mb-8 md:pb-0 lg:-mx-10"
    >
      <div
        className={`${threadOpen ? 'hidden md:flex' : 'flex'} w-full min-h-0 flex-col border-r border-border/80 md:w-80 md:shrink-0 lg:w-[340px]`}
      >
        <ConversationListPane />
      </div>
      <div className={`${threadOpen ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col`}>
        {children}
      </div>
    </div>
  )
}
