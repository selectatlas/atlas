'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { DEMO_TALENT_RESULTS } from '@/lib/demo-data'
import { SavedTalentView } from '@/components/saved/SavedTalentView'
import { Skeleton } from '@/components/ui/skeleton'
import type { Profile, TalentSkill } from '@/types'

export function SavedTalentDemo() {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') === 'liked' ? 'liked' : 'shortlisted'
  const [shortlisted, setShortlisted] = useState<Array<{
    talent_id: string
    created_at: string
    profiles: Profile & { talent_skills: TalentSkill[] }
  }>>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate demo shortlist from sessionStorage on mount */
    if (!isLocalDemoMode()) {
      setReady(true)
      return
    }

    const saved = DEMO_TALENT_RESULTS
      .filter(talent => window.sessionStorage.getItem(`atlas_demo_shortlist_${talent.id}`) === '1')
      .map(talent => ({
        talent_id: talent.id,
        created_at: new Date().toISOString(),
        profiles: talent,
      }))

    setShortlisted(saved)
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  if (!ready) {
    return (
      <div className="space-y-8 py-2 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
      </div>
    )
  }

  return (
    <SavedTalentView
      activeTab={activeTab}
      shortlisted={shortlisted}
      liked={[]}
    />
  )
}
