'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface LikeButtonProps {
  talentId: string
  className?: string
  showCount?: boolean
}

export function LikeButton({ talentId, className = '', showCount = true }: LikeButtonProps) {
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      fetch(`/api/talent/${talentId}/stats`)
        .then(r => r.json())
        .then(data => {
          setLiked(data.liked ?? false)
          setLikesCount(data.likes ?? 0)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [talentId])

  async function toggle() {
    if (toggling) return
    setToggling(true)
    const prevLiked = liked
    const prevCount = likesCount
    setLiked(!prevLiked)
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1)

    try {
      const res = await fetch(`/api/talent/${talentId}/like`, { method: 'POST' })
      if (!res.ok) {
        setLiked(prevLiked)
        setLikesCount(prevCount)
      } else {
        const data = await res.json()
        setLikesCount(data.likes_count)
      }
    } catch {
      setLiked(prevLiked)
      setLikesCount(prevCount)
    }
    setToggling(false)
  }

  if (loading) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={e => { e.preventDefault(); toggle() }}
      className={`gap-1.5 ${liked ? 'text-destructive hover:text-destructive/80' : ''} ${className}`}
      aria-label={liked ? 'Unlike' : 'Like'}
    >
      <svg
        className="w-5 h-5"
        fill={liked ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
      {showCount && (
        <span className="text-xs font-medium">{likesCount > 0 ? likesCount : ''}</span>
      )}
    </Button>
  )
}
