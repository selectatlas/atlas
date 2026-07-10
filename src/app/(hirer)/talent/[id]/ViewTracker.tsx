'use client'

import { useEffect, useRef } from 'react'

interface ViewTrackerProps {
  talentId: string
}

export function ViewTracker({ talentId }: ViewTrackerProps) {
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true

    fetch(`/api/talent/${talentId}/view`, { method: 'POST' }).catch(() => {
      /* silent */
    })
  }, [talentId])

  // This component renders nothing
  return null
}
