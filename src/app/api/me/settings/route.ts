import { createClient } from '@/lib/supabase/server'
import { getPlatformAdminRole } from '@/lib/platform-admin'
import { resolveCallerAccess } from '@/lib/access-core'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import {
  DEFAULT_HIRER_JOB_DEFAULTS,
  DEFAULT_HIRER_OUTREACH_DEFAULTS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeHirerJobDefaults,
  normalizeHirerOutreachDefaults,
  normalizeNotificationPreferences,
  validateSettingsPatch,
} from '@/lib/settings'
import type { AccountType, ProfileVisibility } from '@/types'

type CallerContext = {
  user: { id: string; email?: string | null }
  supabase: Awaited<ReturnType<typeof createClient>>
  accountType: AccountType
  profileVisibility: ProfileVisibility
  canHirer: boolean
  canTalent: boolean
}

type CallerResult =
  | { response: Response }
  | CallerContext

async function getCaller(): Promise<CallerResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type, profile_visibility')
    .eq('id', user.id)
    .single()

  const adminRole = await getPlatformAdminRole(user.id)
  const access = resolveCallerAccess(user.id, profile?.account_type, adminRole)

  if (!profile || (!access.canHirer && !access.canTalent)) {
    return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return {
    user,
    supabase,
    accountType: (profile.account_type as AccountType),
    profileVisibility: (profile.profile_visibility as ProfileVisibility | null) ?? 'public',
    canHirer: access.canHirer,
    canTalent: access.canTalent,
  }
}

export async function GET(): Promise<Response> {
  const caller = await getCaller()
  if ('response' in caller) return caller.response

  const [{ data: notificationRow }, { data: hirerDefaults }] = await Promise.all([
    caller.supabase
      .from('notification_preferences')
      .select('preferences')
      .eq('profile_id', caller.user.id)
      .maybeSingle(),
    caller.accountType === 'hirer'
      ? caller.supabase
          .from('hirer_workspace_defaults')
          .select('job_defaults, outreach_defaults')
          .eq('profile_id', caller.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return Response.json({
    account_type: caller.accountType,
    email: caller.user.email ?? null,
    profile_visibility: caller.profileVisibility,
    notification_preferences: normalizeNotificationPreferences(
      notificationRow?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
    ),
    ...(caller.accountType === 'hirer'
      ? {
          job_defaults: normalizeHirerJobDefaults(hirerDefaults?.job_defaults ?? DEFAULT_HIRER_JOB_DEFAULTS),
          outreach_defaults: normalizeHirerOutreachDefaults(
            hirerDefaults?.outreach_defaults ?? DEFAULT_HIRER_OUTREACH_DEFAULTS,
          ),
        }
      : {}),
  })
}

export async function PATCH(request: Request): Promise<Response> {
  const caller = await getCaller()
  if ('response' in caller) return caller.response

  const limited = await enforceRateLimit(`me-settings:${caller.user.id}`, 60, 30)
  if (limited) return limited

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const parsed = validateSettingsPatch(parsedBody.body, caller.accountType, {
    canHirer: caller.canHirer,
    canTalent: caller.canTalent,
  })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  if (parsed.value.profile_visibility) {
    const { error } = await caller.supabase
      .from('profiles')
      .update({ profile_visibility: parsed.value.profile_visibility })
      .eq('id', caller.user.id)
    if (error) return Response.json({ error: 'Unable to update visibility' }, { status: 500 })
  }

  if (parsed.value.notification_preferences) {
    const { error } = await caller.supabase
      .from('notification_preferences')
      .upsert(
        { profile_id: caller.user.id, preferences: parsed.value.notification_preferences },
        { onConflict: 'profile_id' },
      )
    if (error) return Response.json({ error: 'Unable to update notification preferences' }, { status: 500 })
  }

  if (parsed.value.job_defaults || parsed.value.outreach_defaults) {
    const { data: existing } = await caller.supabase
      .from('hirer_workspace_defaults')
      .select('job_defaults, outreach_defaults')
      .eq('profile_id', caller.user.id)
      .maybeSingle()

    const jobDefaults = parsed.value.job_defaults
      ?? normalizeHirerJobDefaults(existing?.job_defaults ?? DEFAULT_HIRER_JOB_DEFAULTS)
    const outreachDefaults = parsed.value.outreach_defaults
      ?? normalizeHirerOutreachDefaults(existing?.outreach_defaults ?? DEFAULT_HIRER_OUTREACH_DEFAULTS)

    const { error } = await caller.supabase
      .from('hirer_workspace_defaults')
      .upsert(
        {
          profile_id: caller.user.id,
          job_defaults: jobDefaults,
          outreach_defaults: outreachDefaults,
        },
        { onConflict: 'profile_id' },
      )
    if (error) return Response.json({ error: 'Unable to update workspace defaults' }, { status: 500 })
  }

  return GET()
}
