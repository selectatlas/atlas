import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { needsOnboarding } from '@/lib/onboarding'
import { safeInternalPath } from '@/lib/safe-redirect'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { userId, accountType, isLocalDemo } = await getSession()
  // Original destination from a pre-signup CTA (e.g. "Sign up to apply" on a
  // public job). Onboarding is a detour, not the destination - the wizard
  // resumes this path on finish or skip.
  const { next } = await searchParams
  const nextPath = next ? safeInternalPath(next, '') || null : null

  if (isLocalDemo) redirect('/home')
  if (!userId) redirect('/login')
  if (accountType !== 'talent') redirect(nextPath ?? '/home')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, headline, talent_skills(id)')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) redirect('/home')
  if (!needsOnboarding(profile)) redirect(nextPath ?? '/profile')

  return (
    <OnboardingWizard
      profileId={userId}
      fullName={profile.full_name}
      initialAvatarUrl={profile.avatar_url}
      nextPath={nextPath}
    />
  )
}
