import type { SupabaseClient } from '@supabase/supabase-js'
import { logEvent } from '@/lib/log'

export async function purgeUserStorage(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  for (const bucket of ['avatars', 'covers'] as const) {
    try {
      let offset = 0
      while (true) {
        const { data: files } = await service.storage.from(bucket).list(userId, { limit: 100, offset })
        const paths = (files ?? []).map(file => `${userId}/${file.name}`)
        if (paths.length > 0) await service.storage.from(bucket).remove(paths)
        if (!files || files.length < 100) break
        offset += files.length
      }
    } catch (err) {
      logEvent('warn', 'user_storage_cleanup_failed', {
        user_id: userId,
        bucket,
        message: err instanceof Error ? err.message : 'unknown',
      })
    }
  }
}

export async function deleteAuthUser(
  service: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await purgeUserStorage(service, userId)
  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
