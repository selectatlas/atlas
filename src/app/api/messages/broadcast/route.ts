import { getAuthenticatedCaller } from '@/lib/access'
import { parseJsonBody, cleanString, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

// POST /api/messages/broadcast — send one message to every shortlisted
// talent, fanned into the normal 1:1 threads (creating them where needed).
// Each recipient is isolated: one failure doesn't abort the rest.
export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = caller.supabase
  const user = caller.user

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const content = cleanString(parsedBody.body.content, 5000)
  if (!content) return badRequest('content is required (max 5000 characters)')

  const limited = await enforceRateLimit(`messages-broadcast:${user.id}`, 3600, 5)
  if (limited) return limited

  const { data: shortlist } = await supabase
    .from('shortlists')
    .select('talent_id')
    .eq('hirer_id', user.id)
    .limit(50)

  const talentIds = (shortlist ?? []).map(row => row.talent_id as string)
  if (talentIds.length === 0) return badRequest('No shortlisted talent to message')

  const threadIds: string[] = []
  let failed = 0

  for (const talentId of talentIds) {
    try {
      const { data: threadId, error: rpcError } = await supabase.rpc('create_or_get_thread', {
        other_profile_id: talentId,
      })
      if (rpcError || !threadId) {
        failed += 1
        continue
      }
      const { error: insertError } = await supabase
        .from('messages')
        .insert({ thread_id: threadId, sender_id: user.id, content })
      if (insertError) {
        failed += 1
        continue
      }
      threadIds.push(threadId as string)
    } catch {
      failed += 1
    }
  }

  if (failed > 0) {
    logEvent('warn', 'broadcast_partial_failure', {
      user_id: user.id,
      sent: threadIds.length,
      failed,
    })
  }

  if (threadIds.length === 0) {
    return Response.json({ error: 'Failed to send broadcast' }, { status: 500 })
  }

  return Response.json(
    { sent: threadIds.length, failed, total: talentIds.length, thread_ids: threadIds },
    { status: 201 },
  )
}
