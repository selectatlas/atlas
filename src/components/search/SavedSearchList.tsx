'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export type SavedSearchListItem = {
  id: string
  name: string
  description: string
  href: string
  newMatches: number
}

// Run: touch last_viewed_at (clears the alert) then open the search.
// Delete: remove the saved search and refresh the server-rendered list.
export function SavedSearchList({ items }: { items: SavedSearchListItem[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  function handleRun(item: SavedSearchListItem) {
    void fetch(`/api/saved-searches/${item.id}`, { method: 'PATCH' }).catch(() => { /* best effort */ })
    router.push(item.href)
  }

  async function handleDelete(item: SavedSearchListItem) {
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/saved-searches/${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to delete saved search')
      toast.success(`Deleted "${item.name}"`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete saved search')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <Card key={item.id} className="border border-border/80 p-4 shadow-none">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BellRing className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.newMatches > 0 && (
                  <Badge variant="default">{item.newMatches} new</Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{item.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRun(item)}
                aria-label={`Run saved search ${item.name}`}
              >
                <Play className="size-3.5" />
                <span className="hidden sm:inline">Run</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => handleDelete(item)}
                disabled={busyId === item.id}
                aria-label={`Delete saved search ${item.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
