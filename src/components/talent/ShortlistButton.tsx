'use client'

import { useState, useEffect } from 'react'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { Button } from '@/components/ui/button'
import { Bookmark } from 'lucide-react'

interface ShortlistButtonProps {
  talentId: string
  className?: string
}

export function ShortlistButton({ talentId, className = '' }: ShortlistButtonProps) {
  const [shortlisted, setShortlisted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (isLocalDemoMode()) {
      // Session storage is the local preview's external state source; hydrate it once on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShortlisted(window.sessionStorage.getItem(`atlas_demo_shortlist_${talentId}`) === '1')
      setLoading(false)
      return
    }

    fetch('/api/shortlist')
      .then(async r => {
        if (!r.ok) throw new Error('Unable to load shortlist')
        return r.json()
      })
      .then(data => {
        setShortlisted((data.ids ?? []).includes(talentId))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [talentId])

  async function toggle() {
    if (toggling) return
    setToggling(true)
    const prev = shortlisted
    setShortlisted(!prev)

    if (isLocalDemoMode()) {
      const key = `atlas_demo_shortlist_${talentId}`
      if (prev) window.sessionStorage.removeItem(key)
      else window.sessionStorage.setItem(key, '1')
      setToggling(false)
      return
    }

    try {
      const res = await fetch('/api/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talent_id: talentId }),
      })
      if (!res.ok) {
        setShortlisted(prev)
      }
    } catch {
      setShortlisted(prev)
    }
    setToggling(false)
  }

  if (loading) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={e => { e.preventDefault(); toggle() }}
      className={`${shortlisted ? 'text-amber-500 hover:text-amber-600' : ''} ${className}`}
      aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
    >
      <Bookmark className="size-4" fill={shortlisted ? 'currentColor' : 'none'} />
    </Button>
  )
}
