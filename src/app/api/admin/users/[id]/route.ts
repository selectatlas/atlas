import { requirePlatformAdmin, grantPlatformAdmin, revokePlatformAdmin, countPlatformAdmins } from '@/lib/platform-admin'
import { deleteAuthUser } from '@/lib/user-deletion'
import { parseJsonBody, cleanOptionalString, badRequest, isUuid } from '@/lib/validation'
import { logEvent } from '@/lib/log'
import type { AccountType } from '@/types'

type AccountRole = AccountType | 'admin'

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
  if (action !== 'suspend' && action !== 'unsuspend' && action !== 'set_role' && action !== 'set_account_type') {
    return badRequest('action must be suspend, unsuspend, or set_role')
  }

  const { data: target } = await auth.service
    .from('profiles')
    .select('id, account_type, email')
    .eq('id', id)
    .maybeSingle()

  if (!target) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: adminRow } = await auth.service
    .from('platform_admins')
    .select('user_id, role')
    .eq('user_id', id)
    .maybeSingle()

  const isTargetAdmin = Boolean(adminRow)

  if (action === 'set_role' || action === 'set_account_type') {
    const nextRole = (action === 'set_role' ? parsedBody.body.role : parsedBody.body.account_type) as AccountRole
    if (nextRole !== 'hirer' && nextRole !== 'talent' && nextRole !== 'admin') {
      return badRequest('role must be hirer, talent, or admin')
    }

    const currentRole: AccountRole = isTargetAdmin ? 'admin' : target.account_type as AccountType
    if (nextRole === currentRole) {
      return Response.json({
        profile: {
          id: target.id,
          account_type: target.account_type,
          platform_admin_role: adminRow?.role ?? null,
          display_role: currentRole,
        },
      })
    }

    if (nextRole === 'admin' || isTargetAdmin) {
      if (auth.role !== 'owner') {
        return Response.json({ error: 'Only owners can grant or revoke admin access' }, { status: 403 })
      }
    }

    if (isTargetAdmin && nextRole !== 'admin') {
      if (id === auth.userId) {
        return Response.json({ error: 'You cannot remove your own admin access' }, { status: 400 })
      }
      const adminCount = await countPlatformAdmins(auth.service)
      if (adminCount <= 1) {
        return Response.json({ error: 'Cannot remove the last platform admin' }, { status: 400 })
      }
      const revoked = await revokePlatformAdmin(auth.service, id)
      if (!revoked) return Response.json({ error: 'Failed to revoke admin access' }, { status: 500 })
    }

    if (nextRole === 'admin') {
      const granted = await grantPlatformAdmin(auth.service, id, 'owner')
      if (!granted) return Response.json({ error: 'Failed to grant admin access' }, { status: 500 })

      logEvent('info', 'admin_user_promoted', {
        target_id: id,
        admin_id: auth.userId,
      })

      return Response.json({
        profile: {
          id: target.id,
          account_type: target.account_type,
          platform_admin_role: 'owner',
          display_role: 'admin',
        },
      })
    }

    const { data: profile, error } = await auth.service
      .from('profiles')
      .update({ account_type: nextRole })
      .eq('id', id)
      .select('id, account_type')
      .single()

    if (error || !profile) {
      logEvent('error', 'admin_user_role_change_failed', { target_id: id, code: error?.code ?? null })
      return Response.json({ error: 'Update failed' }, { status: 500 })
    }

    const { error: metadataError } = await auth.service.auth.admin.updateUserById(id, {
      user_metadata: { account_type: nextRole },
    })
    if (metadataError) {
      logEvent('warn', 'admin_user_role_metadata_sync_failed', { target_id: id, code: metadataError.code })
    }

    logEvent('info', 'admin_user_role_changed', {
      target_id: id,
      from: currentRole,
      to: nextRole,
      admin_id: auth.userId,
    })

    return Response.json({
      profile: {
        ...profile,
        platform_admin_role: null,
        display_role: nextRole,
      },
    })
  }

  if (isTargetAdmin && action === 'suspend') {
    return Response.json({ error: 'Cannot suspend a platform admin' }, { status: 400 })
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  if (auth.role !== 'owner') {
    return Response.json({ error: 'Only owners can delete accounts' }, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })

  if (id === auth.userId) {
    return Response.json({ error: 'You cannot delete your own account from admin' }, { status: 400 })
  }

  const { data: target } = await auth.service
    .from('profiles')
    .select('id, email')
    .eq('id', id)
    .maybeSingle()

  if (!target) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: adminRow } = await auth.service
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', id)
    .maybeSingle()

  if (adminRow) {
    const adminCount = await countPlatformAdmins(auth.service)
    if (adminCount <= 1) {
      return Response.json({ error: 'Cannot delete the last platform admin' }, { status: 400 })
    }
    return Response.json({ error: 'Remove admin access before deleting this account' }, { status: 400 })
  }

  const deleted = await deleteAuthUser(auth.service, id)
  if (!deleted.ok) {
    logEvent('error', 'admin_user_delete_failed', { target_id: id, message: deleted.message })
    return Response.json({ error: 'Account deletion failed' }, { status: 500 })
  }

  logEvent('warn', 'admin_user_deleted', {
    target_id: id,
    target_email: target.email,
    admin_id: auth.userId,
  })

  return Response.json({ deleted: true })
}
