'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ShortlistButtonProps {
  talentId: string
  className?: string
}

export function ShortlistButton({ talentId, className = '' }: ShortlistButtonProps) {
  const [shortlisted, setShortlisted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const isLocalDemo = process.env.NODE_ENV === 'development' && document.cookie.includes('castd_demo=1')
    if (isLocalDemo) {
      // Session storage is the local preview's external state source; hydrate it once on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShortlisted(window.sessionStorage.getItem(`castd_demo_shortlist_${talentId}`) === '1')
      setLoading(false)
      return
    }

    fetch('/api/shortlist')
      .then(r => r.json())
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

    const isLocalDemo = process.env.NODE_ENV === 'development' && document.cookie.includes('castd_demo=1')
    if (isLocalDemo) {
      const key = `castd_demo_shortlist_${talentId}`
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
      <svg
        className="w-5 h-5"
        fill={shortlisted ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
        />
      </svg>
    </Button>
  )
}
