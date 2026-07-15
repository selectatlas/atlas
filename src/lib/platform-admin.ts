import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/log'
import type { PlatformAdminRole } from '@/types'

export function getAdminAllowlist(): Set<string> {
  const raw = process.env.ATLAS_ADMIN_EMAILS ?? ''
  return new Set(raw.split(',').map(email => email.trim().toLowerCase()).filter(Boolean))
}

export async function getPlatformAdminRole(userId: string): Promise<PlatformAdminRole | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('platform_admins')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  const role = data?.role
  if (role === 'owner' || role === 'moderator' || role === 'support') return role
  return null
}

async function syncPlatformAdminMetadata(userId: string, role: PlatformAdminRole): Promise<void> {
  const service = createServiceClient()
  const { error } = await service.auth.admin.updateUserById(userId, {
    user_metadata: { platform_admin: true, platform_admin_role: role },
  })
  if (error) {
    logEvent('warn', 'platform_admin_metadata_sync_failed', { user_id: userId, code: error.code })
  }
}

// Bootstraps allowlisted emails into platform_admins on first sign-in.
export async function ensurePlatformAdmin(
  userId: string,
  email: string,
): Promise<PlatformAdminRole | null> {
  const existing = await getPlatformAdminRole(userId)
  if (existing) {
    await syncPlatformAdminMetadata(userId, existing)
    return existing
  }

  if (!getAdminAllowlist().has(email.trim().toLowerCase())) return null

  const service = createServiceClient()
  const { data, error } = await service
    .from('platform_admins')
    .upsert({ user_id: userId, role: 'owner' }, { onConflict: 'user_id' })
    .select('role')
    .single()

  if (error || !data) {
    logEvent('error', 'platform_admin_bootstrap_failed', { user_id: userId, code: error?.code ?? null })
    return null
  }

  logEvent('info', 'platform_admin_bootstrapped', { user_id: userId, role: data.role })
  const role = data.role
  const resolved = role === 'owner' || role === 'moderator' || role === 'support' ? role : 'owner'
  await syncPlatformAdminMetadata(userId, resolved)
  return resolved
}

type AdminAuthSuccess = {
  ok: true
  userId: string
  role: PlatformAdminRole
  service: ReturnType<typeof createServiceClient>
}

type AdminAuthFailure = {
  ok: false
  response: Response
}

export async function requirePlatformAdmin(): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  let role = await getPlatformAdminRole(user.id)
  if (!role && user.email) {
    role = await ensurePlatformAdmin(user.id, user.email)
  }
  if (!role) return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }

  return { ok: true, userId: user.id, role, service: createServiceClient() }
}
