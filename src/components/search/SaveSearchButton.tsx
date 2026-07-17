'use client'

import { useState } from 'react'
import { BookmarkPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SAVED_SEARCH_NAME_MAX } from '@/lib/saved-searches'
import { activeFilterCount, type SearchFilters } from '@/lib/search-filters'

type SaveSearchButtonProps = {
  query: string
  filters: SearchFilters
}

// Persists the current search (query + structured filters) as a named saved
// search. Atlas then reports new matching talent in the notifications feed.
export function SaveSearchButton({ query, filters }: SaveSearchButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const trimmedQuery = query.trim()
  if (!trimmedQuery && activeFilterCount(filters) === 0) return null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !name.trim()) {
      setName(trimmedQuery.slice(0, SAVED_SEARCH_NAME_MAX))
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || saving) return
    setSaving(true)
    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, query: trimmedQuery, filters }),
      })
      const data = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error ?? 'Unable to save search')
      toast.success(`Saved "${trimmedName}". Atlas keeps scouting for you.`)
      setOpen(false)
      setName('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save search')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
        aria-label="Save this search"
      >
        <BookmarkPlus className="size-3.5" />
        Save search
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Save this search</DialogTitle>
              <DialogDescription>
                Atlas will keep scouting and alert you when new talent match.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="saved-search-name">Name</Label>
              <Input
                id="saved-search-name"
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={SAVED_SEARCH_NAME_MAX}
                placeholder="e.g. Bollywood dancers in London"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Save search'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
