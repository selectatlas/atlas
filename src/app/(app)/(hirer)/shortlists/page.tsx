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
  'id, full_name, avatar_url, headline, city, country, talent_skills(skill)'

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

  const [shortlistResult, likesResult] = await Promise.all([
    supabase
      .from('shortlists')
      .select(`talent_id, created_at, profiles!talent_id(${TALENT_JOIN})`)
      .eq('hirer_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('profile_likes')
      .select(`talent_id, created_at, profiles!talent_id(${TALENT_JOIN})`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const shortlisted = (shortlistResult.data ?? []) as unknown as SavedRow[]
  const liked = (likesResult.data ?? []) as unknown as SavedRow[]

  return (
    <SavedTalentView
      activeTab={activeTab}
      shortlisted={shortlisted}
      liked={liked}
    />
  )
}
