import { requirePlatformAdmin } from '@/lib/platform-admin'
import { logEvent } from '@/lib/log'

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
  const accountType = url.searchParams.get('account_type')
  const suspended = url.searchParams.get('suspended')
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))

  let query = auth.service
    .from('profiles')
    .select('id, account_type, full_name, email, city, country, suspended_at, suspension_reason, profile_visibility, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (accountType === 'hirer' || accountType === 'talent') {
    query = query.eq('account_type', accountType)
  }

  if (suspended === 'true') {
    query = query.not('suspended_at', 'is', null)
  } else if (suspended === 'false') {
    query = query.is('suspended_at', null)
  }

  if (q.length > 0) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: users, error } = await query
  if (error) {
    logEvent('error', 'admin_users_list_failed', { code: error.code })
    return Response.json({ error: 'Failed to load users' }, { status: 500 })
  }

  return Response.json({ users: users ?? [] })
}
