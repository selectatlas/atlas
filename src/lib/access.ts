import { createClient } from '@/lib/supabase/server'
import { getPlatformAdminRole } from '@/lib/platform-admin'
import { resolveCallerAccess, type CallerAccess } from '@/lib/access-core'

export type { CallerAccess }
export { canActAsHirer, canActAsTalent, resolveCallerAccess } from '@/lib/access-core'

type AuthCallerSuccess = {
  ok: true
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string }
  access: CallerAccess
}

type AuthCallerFailure = {
  ok: false
  response: Response
}

export async function getAuthenticatedCaller(): Promise<AuthCallerSuccess | AuthCallerFailure> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const [{ data: profile }, adminRole, suspendedResult] = await Promise.all([
    supabase.from('profiles').select('account_type').eq('id', user.id).single(),
    getPlatformAdminRole(user.id),
    // suspended_at is deliberately not column-granted to authenticated;
    // this security-definer function (migration 022) is the supported check.
    supabase.rpc('is_caller_suspended'),
  ])

  // Suspension must hold at the API layer, not just the page redirect - a
  // suspended user with a live session can otherwise keep calling routes.
  if (suspendedResult.data === true) {
    return { ok: false, response: Response.json({ error: 'Account suspended' }, { status: 403 }) }
  }

  return {
    ok: true,
    supabase,
    user,
    access: resolveCallerAccess(user.id, profile?.account_type, adminRole),
  }
}
