import { createClient } from '@/lib/supabase/server'
import { generateMessageAssist, type MessageAssistMode } from '@/lib/openai'
import { parseJsonBody, isUuid, cleanOptionalString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

const ASSIST_MODES: MessageAssistMode[] = ['draft', 'rephrase', 'friendlier', 'concise']

// POST /api/messages/assist — AI reply suggestion / draft rewrite for a thread
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { thread_id } = parsedBody.body

  if (!isUuid(thread_id)) return badRequest('thread_id must be a valid id')
  const modeInput = parsedBody.body.mode
  if (typeof modeInput !== 'string' || !(ASSIST_MODES as string[]).includes(modeInput)) {
    return badRequest('mode must be draft, rephrase, friendlier, or concise')
  }
  const mode = modeInput as MessageAssistMode

  const draft = cleanOptionalString(parsedBody.body.draft, 5000)
  if (!draft.ok) return badRequest('draft must be 5000 characters or fewer')
  if (mode !== 'draft' && !draft.value) return badRequest('draft is required for rewrite modes')

  // Verify the caller participates in the thread (both roles may use assist)
  const { data: participant } = await supabase
    .from('thread_participants')
    .select('profile_id')
    .eq('thread_id', thread_id)
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!participant) return Response.json({ error: 'Not a participant' }, { status: 403 })

  const limited =
    (await enforceRateLimit(`messages-assist:${user.id}`, 60, 10)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  const [{ data: callerProfile }, { data: other }, { data: thread }, { data: messages }] = await Promise.all([
    supabase.from('profiles').select('account_type').eq('id', user.id).single(),
    supabase
      .from('thread_participants')
      .select('profiles(full_name)')
      .eq('thread_id', thread_id)
      .neq('profile_id', user.id)
      .maybeSingle(),
    supabase.from('message_threads').select('jobs(title)').eq('id', thread_id).maybeSingle(),
    supabase
      .from('messages')
      .select('content, sender_id, created_at')
      .eq('thread_id', thread_id)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const otherProfile = (other?.profiles ?? null) as { full_name: string } | null
  const originJob = (thread?.jobs ?? null) as unknown as { title: string } | null
  const senderRole = callerProfile?.account_type === 'hirer' ? 'hirer' : 'talent'
  const recentMessages = (messages ?? [])
    .reverse()
    .map(m => ({ fromMe: m.sender_id === user.id, content: m.content as string }))

  try {
    const message = await generateMessageAssist({
      mode,
      draft: draft.value ?? undefined,
      senderRole,
      otherName: otherProfile?.full_name ?? 'the other person',
      recentMessages,
      jobTitle: originJob?.title ?? null,
    })
    if (!message) throw new Error('empty completion')
    return Response.json({ message })
  } catch (err) {
    logEvent('error', 'message_assist_openai_error', {
      user_id: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return Response.json({ error: 'Writing assistance is temporarily unavailable' }, { status: 503 })
  }
}
