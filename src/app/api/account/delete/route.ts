import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseJsonBody, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { purgeUserStorage } from '@/lib/user-deletion'

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
  // Failures are logged inside and deletion proceeds; orphaned files are
  // swept by the ops runbook.
  await purgeUserStorage(service, user.id)

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
