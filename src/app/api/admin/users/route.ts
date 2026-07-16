import { requirePlatformAdmin, grantPlatformAdmin } from '@/lib/platform-admin'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { logEvent } from '@/lib/log'
import type { AccountType } from '@/types'

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  // q is interpolated into a PostgREST .or() filter: strip the characters
  // that delimit filter expressions (`,` `(` `)` `"` `\`) so a crafted
  // search term cannot inject additional filter clauses.
  const q = (url.searchParams.get('q') ?? '').replace(/[,()"\\]/g, '').trim().slice(0, 100)
  const accountType = url.searchParams.get('account_type')
  const roleFilter = url.searchParams.get('role')
  const suspended = url.searchParams.get('suspended')
  const limitRaw = Number(url.searchParams.get('limit') ?? 50)
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50))

  if (roleFilter === 'admin') {
    const { data: adminRows, error: adminError } = await auth.service
      .from('platform_admins')
      .select('user_id, role')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (adminError) {
      logEvent('error', 'admin_users_list_failed', { code: adminError.code })
      return Response.json({ error: 'Failed to load users' }, { status: 500 })
    }

    const adminIds = (adminRows ?? []).map(row => row.user_id)
    if (adminIds.length === 0) return Response.json({ users: [] })

    let query = auth.service
      .from('profiles')
      .select('id, account_type, full_name, email, city, country, suspended_at, suspension_reason, profile_visibility, verified_at, verified_categories, created_at')
      .in('id', adminIds)
      .order('created_at', { ascending: false })

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

    const adminRoleById = new Map((adminRows ?? []).map(row => [row.user_id, row.role]))
    const enriched = (users ?? []).map(user => ({
      ...user,
      platform_admin_role: adminRoleById.get(user.id) ?? null,
      display_role: 'admin' as const,
    }))

    return Response.json({ users: enriched })
  }

  let query = auth.service
    .from('profiles')
    .select('id, account_type, full_name, email, city, country, suspended_at, suspension_reason, profile_visibility, verified_at, verified_categories, created_at')
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

  const rows = users ?? []
  const userIds = rows.map(user => user.id)
  const { data: adminRows } = userIds.length > 0
    ? await auth.service.from('platform_admins').select('user_id, role').in('user_id', userIds)
    : { data: [] as Array<{ user_id: string; role: string }> }

  const adminRoleById = new Map((adminRows ?? []).map(row => [row.user_id, row.role]))
  const enriched = rows.map(user => {
    const platformAdminRole = adminRoleById.get(user.id) ?? null
    return {
      ...user,
      platform_admin_role: platformAdminRole,
      display_role: platformAdminRole ? 'admin' as const : user.account_type as AccountType,
    }
  })

  return Response.json({ users: enriched })
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const fullName = cleanString(parsedBody.body.full_name, 120)
  const email = cleanString(parsedBody.body.email, 320)?.toLowerCase() ?? null
  const role = parsedBody.body.role

  if (!fullName) return badRequest('full_name is required (max 120 characters)')
  if (!email || !email.includes('@')) return badRequest('A valid email is required')
  if (role !== 'hirer' && role !== 'talent' && role !== 'admin') {
    return badRequest('role must be hirer, talent, or admin')
  }

  if (role === 'admin' && auth.role !== 'owner') {
    return Response.json({ error: 'Only owners can create admin accounts' }, { status: 403 })
  }

  const { data: existing } = await auth.service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return badRequest('A user with this email already exists')

  // Admins keep an underlying hirer profile; platform access comes from platform_admins.
  const accountType: AccountType = role === 'admin' ? 'hirer' : role

  const { data: authData, error: createError } = await auth.service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, account_type: accountType },
  })

  if (createError || !authData.user) {
    logEvent('error', 'admin_account_create_failed', { code: createError?.code ?? null })
    return Response.json({ error: 'Failed to create account' }, { status: 500 })
  }

  if (role === 'admin') {
    const granted = await grantPlatformAdmin(auth.service, authData.user.id, 'owner')
    if (!granted) {
      return Response.json({ error: 'Account created but granting admin access failed' }, { status: 500 })
    }
  }

  logEvent('info', 'admin_account_created', {
    target_id: authData.user.id,
    role,
    admin_id: auth.userId,
  })

  return Response.json({
    user: {
      id: authData.user.id,
      email,
      full_name: fullName,
      account_type: accountType,
      platform_admin_role: role === 'admin' ? 'owner' : null,
      display_role: role,
    },
  }, { status: 201 })
}
