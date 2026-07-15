'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppShell } from '@/components/layout/app-shell-context'
import { getSearchTarget } from '@/lib/page-meta'

type MobileSearchSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSearchSheet({ open, onOpenChange }: MobileSearchSheetProps) {
  const router = useRouter()
  const { accountType } = useAppShell()
  const [query, setQuery] = useState('')
  const searchTarget = getSearchTarget(accountType)
  const placeholder = accountType === 'hirer' ? 'Search talent…' : 'Search jobs…'

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    router.push(trimmed ? `${searchTarget}?q=${encodeURIComponent(trimmed)}` : searchTarget)
    onOpenChange(false)
    setQuery('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            {accountType === 'hirer'
              ? 'Find talent by name, skill, or brief.'
              : 'Filter open jobs on Discover.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={placeholder}
              className="pl-9"
              aria-label={placeholder}
            />
          </div>
          <Button type="submit">Go</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
