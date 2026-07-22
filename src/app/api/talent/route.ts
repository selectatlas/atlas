import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlatformAdminRole } from '@/lib/platform-admin'
import { canActAsHirer } from '@/lib/access-core'
import { parseSearchFilterParams } from '@/lib/search-filters'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { fetchTalentBrowse } from '@/lib/talent-browse'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const hasDemoCookie = process.env.NODE_ENV === 'development' &&
    /(?:^|;\s*)atlas_demo=1(?:;|$)/.test(request.headers.get('cookie') ?? '')
  const isLocalDemo = hasDemoCookie && !user
  if (!user && !isLocalDemo) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isLocalDemo) {
    const [{ data: caller }, adminRole] = await Promise.all([
      supabase.from('profiles').select('account_type').eq('id', user!.id).single(),
      getPlatformAdminRole(user!.id),
    ])
    if (!canActAsHirer(caller?.account_type, adminRole !== null)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const limited = await enforceRateLimit(`talent-browse:${user?.id ?? 'local-demo'}`, 60, 60)
  if (limited) return limited

  const url = new URL(request.url)
  const parsed = parseSearchFilterParams(url.searchParams)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const page = Math.max(1, Math.min(1000, Math.trunc(Number(url.searchParams.get('page')) || 1)))
  const limit = Math.max(1, Math.min(100, Math.trunc(Number(url.searchParams.get('limit')) || 24)))
  const sort = url.searchParams.get('sort') === 'available' ? 'available' : 'newest'
  const service = createServiceClient()
  const browse = await fetchTalentBrowse(service, {
    filters: parsed.filters,
    limit,
    offset: (page - 1) * limit,
    sort,
  })

  if ('error' in browse) {
    logEvent('error', 'talent_browse_error', { user_id: user?.id ?? null })
    return Response.json({ error: 'Unable to load talent' }, { status: 500 })
  }

  return Response.json({
    results: browse.results,
    total: browse.total,
    page,
    limit,
  })
}
