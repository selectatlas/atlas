import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { getPostHogClient } from '@/lib/posthog-server'
import { logEvent } from '@/lib/log'
import { ensurePlatformAdmin } from '@/lib/platform-admin'
import { needsOnboarding } from '@/lib/onboarding'
import { safeInternalPath } from '@/lib/safe-redirect'
import type { EmailOtpType } from '@supabase/supabase-js'
import type { AccountType } from '@/types'

// GET /auth/callback — completes sign-in and lands the user on the dashboard.
// Two entry points: OAuth (Google) PKCE redirects here with a one-time `code`;
// email confirmation / magic links redirect here with `token_hash` + `type`.
export async function GET(request: Request) {
  const url = new URL(request.url)

  const limited = await enforceRateLimit(`oauth-callback:${getClientIp(request)}`, 900, 20)
  if (limited) return limited

  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/login?error=oauth', url.origin))
  }

  const supabase = await createClient()
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        type: (url.searchParams.get('type') as EmailOtpType | null) ?? 'email',
        token_hash: tokenHash!,
      })

  if (error || !data.user) {
    logEvent('warn', 'auth_callback_failed', {
      method: code ? 'oauth' : 'email_link',
      message: error?.message ?? 'no user',
    })
    return NextResponse.redirect(new URL(code ? '/login?error=oauth' : '/login?error=confirm', url.origin))
  }

  const user = data.user
  let accountType = user.user_metadata?.account_type as AccountType | undefined
  const isNewOauthUser = accountType !== 'hirer' && accountType !== 'talent'

  if (isNewOauthUser) {
    // First sign-in via OAuth: metadata has no account_type, and the
    // handle_new_user trigger has already created the profile as 'talent'.
    // Apply the type chosen on the signup page (query param set before the
    // OAuth redirect); anything else defaults to 'talent'.
    const chosen: AccountType = url.searchParams.get('account_type') === 'hirer' ? 'hirer' : 'talent'

    await supabase.auth.updateUser({ data: { account_type: chosen } })
    if (chosen === 'hirer') {
      // account_type on profiles is server-managed (protect_profile_identity),
      // so correcting the trigger's 'talent' default needs the service role.
      const service = createServiceClient()
      const { error: profileError } = await service
        .from('profiles')
        .update({ account_type: chosen })
        .eq('id', user.id)
      if (profileError) {
        logEvent('error', 'oauth_profile_account_type_failed', { user_id: user.id })
      }
    }
    accountType = chosen
  }

  try {
    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: user.id,
      event: isNewOauthUser ? 'user_signed_up' : 'user_signed_in',
      properties: { account_type: accountType, method: code ? 'google' : 'email' },
    })
  } catch {
    // Analytics must never block sign-in.
  }

  const adminRole = user.email ? await ensurePlatformAdmin(user.id, user.email) : null

  // Talent with an untouched profile (no headline, no skills) go through
  // onboarding instead of an empty dashboard - covers email-confirmation
  // and OAuth signups, which both land here rather than on the signup page.
  // A validated ?next= target (public job CTAs) replaces the /home default;
  // the onboarding check below still overrides it.
  let landingPath = safeInternalPath(url.searchParams.get('next'))
  if (accountType === 'talent' && !adminRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('headline, talent_skills(id)')
      .eq('id', user.id)
      .maybeSingle()
    if (needsOnboarding(profile)) landingPath = '/onboarding'
  }

  const response = NextResponse.redirect(new URL(landingPath, url.origin))
  // A leftover local-demo cookie must never mask a real session.
  response.cookies.delete('atlas_demo')
  response.cookies.delete('atlas_demo_role')
  return response
}
