import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { needsOnboarding } from '@/lib/onboarding'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default async function OnboardingPage() {
  const { userId, accountType, isLocalDemo } = await getSession()

  if (isLocalDemo) redirect('/home')
  if (!userId) redirect('/login')
  if (accountType !== 'talent') redirect('/home')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, headline, talent_skills(id)')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) redirect('/home')
  if (!needsOnboarding(profile)) redirect('/profile')

  return (
    <OnboardingWizard
      profileId={userId}
      fullName={profile.full_name}
      initialAvatarUrl={profile.avatar_url}
    />
  )
}
