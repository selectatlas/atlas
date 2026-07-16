import type { SupabaseClient } from '@supabase/supabase-js'
import { logEvent } from '@/lib/log'

export async function purgeUserStorage(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  for (const bucket of ['avatars', 'covers'] as const) {
    try {
      // Always re-list the first page: deleting shifts the remaining objects
      // down, so a moving offset would skip every other page. Bounded so a
      // remove that silently deletes nothing cannot spin forever.
      for (let page = 0; page < 100; page++) {
        const { data: files } = await service.storage.from(bucket).list(userId, { limit: 100 })
        if (!files || files.length === 0) break
        const { error } = await service.storage.from(bucket).remove(files.map(file => `${userId}/${file.name}`))
        if (error) throw error
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
