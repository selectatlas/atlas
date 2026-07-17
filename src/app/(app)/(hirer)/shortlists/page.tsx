import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { SavedTalentView } from '@/components/saved/SavedTalentView'
import { SavedTalentDemo } from '@/components/saved/SavedTalentDemo'
import ShortlistsLoading from './loading'
import type { Profile, TalentSkill } from '@/types'

type SavedRow = {
  talent_id: string
  created_at: string
  profiles: (Profile & { talent_skills: TalentSkill[] }) | null
}

const TALENT_JOIN =
  'id, full_name, avatar_url, headline, city, country, rates, availability, verified_at, verified_categories, talent_skills(id, skill, category, proficiency)'

export default async function ShortlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ tab }, session] = await Promise.all([searchParams, getSession()])
  const activeTab = tab === 'liked' ? 'liked' : 'shortlisted'

  if (session.isLocalDemo) {
    return (
      <Suspense fallback={<ShortlistsLoading />}>
        <SavedTalentDemo />
      </Suspense>
    )
  }

  const supabase = await createClient()

  let { userId } = session
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    userId = user.id
  }

  const [shortlistResult, likesResult, jobsResult] = await Promise.all([
    // Inner join + visibility filter: talent who went private (including
    // suspended talent, whose visibility is forced private) drop out of
    // saved lists instead of leaking their profile through them.
    supabase
      .from('shortlists')
      .select(`talent_id, created_at, profiles!talent_id!inner(${TALENT_JOIN})`)
      .eq('hirer_id', userId)
      .neq('profiles.profile_visibility', 'private')
      .order('created_at', { ascending: false }),
    supabase
      .from('profile_likes')
      .select(`talent_id, created_at, profiles!talent_id!inner(${TALENT_JOIN})`)
      .eq('user_id', userId)
      .neq('profiles.profile_visibility', 'private')
      .order('created_at', { ascending: false }),
    supabase
      .from('jobs')
      .select('id, title')
      .eq('hirer_id', userId)
      .eq('status', 'open')
      .is('removed_at', null)
      .order('created_at', { ascending: false }),
  ])

  const shortlisted = (shortlistResult.data ?? []) as unknown as SavedRow[]
  const liked = (likesResult.data ?? []) as unknown as SavedRow[]
  const jobs = (jobsResult.data ?? []) as Array<{ id: string; title: string }>

  return (
    <SavedTalentView
      activeTab={activeTab}
      shortlisted={shortlisted}
      liked={liked}
      jobs={jobs}
    />
  )
}
