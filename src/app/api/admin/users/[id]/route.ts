import { requirePlatformAdmin } from '@/lib/platform-admin'
import { parseJsonBody, cleanOptionalString, badRequest, isUuid } from '@/lib/validation'
import { logEvent } from '@/lib/log'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response

  const { action } = parsedBody.body
  if (action !== 'suspend' && action !== 'unsuspend' && action !== 'set_account_type') {
    return badRequest('action must be suspend, unsuspend, or set_account_type')
  }

  const { data: target } = await auth.service
    .from('profiles')
    .select('id, account_type, email')
    .eq('id', id)
    .maybeSingle()

  if (!target) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: isAdmin } = await auth.service
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', id)
    .maybeSingle()

  if (isAdmin && (action === 'suspend' || action === 'set_account_type')) {
    return Response.json({ error: 'Cannot modify a platform admin account' }, { status: 400 })
  }

  if (action === 'set_account_type') {
    const nextType = parsedBody.body.account_type
    if (nextType !== 'hirer' && nextType !== 'talent') {
      return badRequest('account_type must be hirer or talent')
    }
    if (nextType === target.account_type) {
      return Response.json({ profile: { id: target.id, account_type: target.account_type } })
    }

    const { data: profile, error } = await auth.service
      .from('profiles')
      .update({ account_type: nextType })
      .eq('id', id)
      .select('id, account_type')
      .single()

    if (error || !profile) {
      logEvent('error', 'admin_user_role_change_failed', { target_id: id, code: error?.code ?? null })
      return Response.json({ error: 'Update failed' }, { status: 500 })
    }

    const { error: metadataError } = await auth.service.auth.admin.updateUserById(id, {
      user_metadata: { account_type: nextType },
    })
    if (metadataError) {
      logEvent('warn', 'admin_user_role_metadata_sync_failed', { target_id: id, code: metadataError.code })
    }

    logEvent('info', 'admin_user_role_changed', {
      target_id: id,
      from: target.account_type,
      to: nextType,
      admin_id: auth.userId,
    })

    return Response.json({ profile })
  }

  const reason = cleanOptionalString(parsedBody.body.reason, 500)
  if (!reason.ok) return badRequest('reason must be 500 characters or fewer')

  if (action === 'suspend' && !reason.value) {
    return badRequest('reason is required when suspending')
  }

  const patch =
    action === 'suspend'
      ? {
          suspended_at: new Date().toISOString(),
          suspension_reason: reason.value,
          profile_visibility: 'private' as const,
        }
      : {
          suspended_at: null,
          suspension_reason: null,
        }

  const { data: profile, error } = await auth.service
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select('id, suspended_at, suspension_reason, profile_visibility')
    .single()

  if (error || !profile) {
    logEvent('error', 'admin_user_suspend_failed', { target_id: id, code: error?.code ?? null })
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  logEvent('warn', 'admin_user_moderation', {
    target_id: id,
    action,
    admin_id: auth.userId,
  })

  return Response.json({ profile })
}
