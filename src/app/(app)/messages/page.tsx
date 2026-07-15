'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { nameInitial } from '@/lib/display'

interface Thread {
  id: string
  otherName: string
  otherAvatar: string | null
  lastMessage: string
  lastSenderId: string
  lastMessageAt: string
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (isLocalDemoMode()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
    })

    fetch('/api/messages/threads')
      .then(async r => {
        if (!r.ok) throw new Error('Unable to load messages')
        return r.json()
      })
      .then(data => {
        setThreads(data.threads ?? [])
        setLoading(false)
      })
      .catch(() => {
        setLoadError('Unable to load messages')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel('messages-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          fetch('/api/messages/threads')
            .then(r => r.json())
            .then(data => setThreads(data.threads ?? []))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  if (loading) {
    return (
      <div className="py-4 space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 bg-muted rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4 py-2">
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 py-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep every conversation with your creative network in one place.</p>
      </div>

      {threads.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><SearchX className="size-5" /></div>
          <p className="font-medium">No messages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Start a conversation from search, outreach, or a talent profile.</p>
        </div>
      ) : (
        <div className="space-y-2 card-stagger">
          {threads.map(thread => (
            <Link key={thread.id} href={`/messages/${thread.id}`}>
              <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 rounded-xl">
                    <AvatarImage src={thread.otherAvatar ?? ''} alt={thread.otherName} />
                    <AvatarFallback className="rounded-xl text-lg font-bold">
                      {nameInitial(thread.otherName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{thread.otherName}</p>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {formatTime(thread.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">
                      {thread.lastSenderId === userId ? 'You: ' : ''}
                      {thread.lastMessage}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHrs = diffMs / (1000 * 60 * 60)

  if (diffHrs < 24) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffHrs < 48) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
