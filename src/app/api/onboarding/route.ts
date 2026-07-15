import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { needsOnboarding, validateOnboardingPayload } from '@/lib/onboarding'
import { logEvent } from '@/lib/log'

// POST /api/onboarding — completes the talent onboarding wizard in one
// server-validated mutation: profile basics, initial skills, and the
// structured availability flag. Only runs against YOUR OWN profile, and only
// while the profile is still untouched (no headline, no skills) so a replay
// cannot duplicate skills or overwrite an established profile.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceRateLimit(`onboarding:${user.id}`, 3600, 10)
  if (limited) return limited

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const parsed = validateOnboardingPayload(parsedBody.body)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type, headline, talent_skills(id)')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.account_type !== 'talent') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!needsOnboarding(profile)) {
    return Response.json({ error: 'Profile is already set up' }, { status: 409 })
  }

  const { category, skills, headline, bio, city, country, rates, availableNow } = parsed.value

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ headline, bio, city, country, rates })
    .eq('id', user.id)

  if (profileError) {
    logEvent('error', 'onboarding_profile_update_failed', { user_id: user.id, code: profileError.code ?? null })
    return Response.json({ error: 'Unable to save your profile' }, { status: 500 })
  }

  const { error: skillsError } = await supabase.from('talent_skills').insert(
    skills.map(skill => ({ profile_id: user.id, category, skill, proficiency: 'intermediate' }))
  )

  if (skillsError) {
    logEvent('error', 'onboarding_skills_insert_failed', { user_id: user.id, code: skillsError.code ?? null })
    return Response.json({ error: 'Unable to save your skills' }, { status: 500 })
  }

  // talent_profiles has direct table access revoked for authenticated users
  // (same as /api/profile/attributes), so the availability flag goes through
  // the service client. Non-fatal: the profile itself is already complete.
  const service = createServiceClient()
  const { error: attributesError } = await service
    .from('talent_profiles')
    .upsert({ profile_id: user.id, available_now: availableNow }, { onConflict: 'profile_id' })

  if (attributesError) {
    logEvent('warn', 'onboarding_attributes_upsert_failed', { user_id: user.id, code: attributesError.code ?? null })
  }

  return Response.json({ success: true }, { status: 201 })
}
