import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseJsonBody, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

// POST /api/account/delete — permanent self-service account deletion.
//
// Deliberately immediate and irreversible: the caller must send
// { confirm: "delete my account" } exactly. Every dependent row (profile,
// skills, jobs, applications, outreach, shortlists, likes, views, messages
// via thread participants, blocks, reports, embeddings) is removed by the
// ON DELETE CASCADE chain from profiles; storage files are removed explicitly.
//
// A cooling-off grace period needs a scheduled job to finalise deletions -
// revisit once Vercel cron exists (launch checklist step 20 records the
// decision owner).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  if (parsedBody.body.confirm !== 'delete my account') {
    return badRequest('Send { "confirm": "delete my account" } to permanently delete your account')
  }

  const limited = await enforceRateLimit(`account-delete:${user.id}`, 3600, 3)
  if (limited) return limited

  const service = createServiceClient()

  // Remove uploaded media first - storage objects do not cascade from auth.
  for (const bucket of ['avatars', 'covers']) {
    try {
      let offset = 0
      while (true) {
        const { data: files } = await service.storage.from(bucket).list(user.id, { limit: 100, offset })
        const paths = (files ?? []).map(file => `${user.id}/${file.name}`)
        if (paths.length > 0) await service.storage.from(bucket).remove(paths)
        if (!files || files.length < 100) break
        offset += files.length
      }
    } catch (err) {
      // Deletion proceeds; orphaned files are swept by the ops runbook.
      logEvent('warn', 'account_delete_storage_cleanup_failed', {
        user_id: user.id,
        bucket,
        message: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) {
    logEvent('error', 'account_delete_failed', { user_id: user.id, message: error.message })
    return Response.json({ error: 'Account deletion failed. Contact support.' }, { status: 500 })
  }

  logEvent('info', 'account_deleted', { user_id: user.id })

  // The auth user is gone; clear the local session cookies too.
  await supabase.auth.signOut().catch(() => undefined)

  return Response.json({ deleted: true })
}
