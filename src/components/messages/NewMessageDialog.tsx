'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, SquarePen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { nameInitial } from '@/lib/display'
import { emitThreadsChanged } from '@/components/messages/types'

type TalentResult = {
  id: string
  full_name: string
  avatar_url: string | null
  headline: string | null
  city: string | null
}

// Hirer-only compose entry point: pick a talent, jump straight into the
// conversation (find-or-create via the same RPC-backed route used everywhere).
export function NewMessageDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TalentResult[]>([])
  const [searching, setSearching] = useState(false)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!cancelled) setSearching(true)
        const supabase = createClient()
        let request = supabase
          .from('profiles')
          .select('id, full_name, avatar_url, headline, city')
          .eq('account_type', 'talent')
          .order('full_name')
          .limit(8)
        if (query.trim()) request = request.ilike('full_name', `%${query.trim()}%`)
        const { data } = await request
        if (cancelled) return
        setResults((data as TalentResult[] | null) ?? [])
        setSearching(false)
      })()
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query])

  async function startConversation(talentId: string) {
    if (creatingId) return
    setCreatingId(talentId)
    setError(null)
    try {
      const res = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talent_id: talentId }),
      })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as { thread_id?: string }
      if (!data.thread_id) throw new Error('failed')
      emitThreadsChanged()
      setOpen(false)
      setQuery('')
      router.push(`/messages/${data.thread_id}`)
    } catch {
      setError('Could not start the conversation. Try again.')
    } finally {
      setCreatingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) { setQuery(''); setError(null) } }}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="New message" />}
      >
        <SquarePen className="size-4" />
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/80 px-4 py-3">
          <DialogTitle className="text-sm">New message</DialogTitle>
          <DialogDescription className="text-xs">
            Start a conversation with a talent.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/80 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search talent by name..."
              className="pl-8"
              aria-label="Search talent"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {error && <p className="px-2 pb-2 text-xs text-destructive" role="alert">{error}</p>}
          {searching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No talent found{query.trim() ? ` for "${query.trim()}"` : ''}.
            </p>
          ) : (
            results.map(talent => (
              <button
                key={talent.id}
                type="button"
                disabled={creatingId !== null}
                onClick={() => void startConversation(talent.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
              >
                <Avatar className="size-9 shrink-0 rounded-xl">
                  <AvatarImage src={talent.avatar_url ?? ''} alt={talent.full_name} />
                  <AvatarFallback className="rounded-xl text-sm font-bold">
                    {nameInitial(talent.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{talent.full_name}</span>
                  {(talent.headline || talent.city) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {talent.headline ?? talent.city}
                    </span>
                  )}
                </span>
                {creatingId === talent.id && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
