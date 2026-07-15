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

  const [{ data: profile }, adminRole] = await Promise.all([
    supabase.from('profiles').select('account_type').eq('id', user.id).single(),
    getPlatformAdminRole(user.id),
  ])

  return {
    ok: true,
    supabase,
    user,
    access: resolveCallerAccess(user.id, profile?.account_type, adminRole),
  }
}
