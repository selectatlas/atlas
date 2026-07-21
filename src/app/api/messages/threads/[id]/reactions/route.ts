import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { isReactionEmoji } from '@/lib/reactions'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/messages/threads/[id]/reactions — set or clear my reaction on a
// message. A string emoji sets/replaces it (one per user per message), null
// removes it. Single toggle endpoint avoids DELETE-with-body quirks.
export async function POST(request: Request, { params }: RouteParams) {
  const { id: threadId } = await params
  if (!isUuid(threadId)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { message_id: messageId, emoji } = parsedBody.body
  if (!isUuid(messageId)) return badRequest('message_id must be a uuid')
  if (emoji !== null && !isReactionEmoji(emoji)) {
    return badRequest('emoji must be one of the supported reactions or null')
  }

  const limited = await enforceRateLimit(`reactions:${user.id}`, 60, 60)
  if (limited) return limited

  // Verify participant
  const { data: participant } = await supabase
    .from('thread_participants')
    .select('profile_id')
    .eq('thread_id', threadId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!participant) return Response.json({ error: 'Not a participant' }, { status: 403 })

  // The message must belong to this thread; RLS scopes visibility, so a
  // cross-thread or foreign id simply won't resolve.
  const { data: message } = await supabase
    .from('messages')
    .select('id')
    .eq('id', messageId)
    .eq('thread_id', threadId)
    .maybeSingle()

  if (!message) return badRequest('message_id must reference a message in this thread')

  if (emoji === null) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('profile_id', user.id)
    if (error) {
      logEvent('error', 'reaction_delete_error', { user_id: user.id, code: error.code ?? null })
      return Response.json({ error: 'Failed to update reaction' }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .upsert(
        { message_id: messageId, profile_id: user.id, emoji },
        { onConflict: 'message_id,profile_id' },
      )
    if (error) {
      logEvent('error', 'reaction_upsert_error', { user_id: user.id, code: error.code ?? null })
      return Response.json({ error: 'Failed to update reaction' }, { status: 500 })
    }
  }

  return Response.json({ message_id: messageId, emoji })
}
