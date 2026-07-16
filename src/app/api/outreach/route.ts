import { getAuthenticatedCaller } from '@/lib/access'
import { generateOutreachMessage } from '@/lib/openai'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { parseJsonBody, isUuid, cleanString, cleanOptionalString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'
import { getPostHogClient } from '@/lib/posthog-server'

export async function POST(request: Request) {
  const caller = await getAuthenticatedCaller()
  if (!caller.ok) return caller.response
  if (!caller.access.canHirer) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = caller.supabase
  const user = caller.user

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { talent_id, action, job_id } = parsedBody.body

  if (!isUuid(talent_id)) return badRequest('talent_id must be a valid id')
  if (job_id !== undefined && job_id !== null && !isUuid(job_id)) {
    return badRequest('job_id must be a valid id')
  }
  if (action !== 'generate' && action !== 'send') {
    return badRequest('action must be generate or send')
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('account_type, full_name')
    .eq('id', user.id)
    .single()

  // The target must be a talent profile
  const { data: talent } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .eq('id', talent_id)
    .eq('account_type', 'talent')
    .single()
  if (!talent) return Response.json({ error: 'Talent not found' }, { status: 404 })

  if (action === 'send') {
    const message = cleanString(parsedBody.body.message, 2000)
    if (!message) return badRequest('message is required (max 2000 characters)')

    const limited = await enforceRateLimit(`outreach-send:${user.id}`, 3600, 30)
    if (limited) return limited

    // Insert the tracking row first so the thread can record it as its origin.
    const { data: outreachRow, error: outreachError } = await supabase
      .from('outreach')
      .insert({ hirer_id: user.id, talent_id, message, status: 'sent' })
      .select('id')
      .single()
    if (outreachError || !outreachRow) {
      logEvent('error', 'outreach_insert_error', { user_id: user.id, code: outreachError?.code ?? null })
      return Response.json({ error: 'Failed to send message' }, { status: 500 })
    }

    const { data: createdThreadId, error: threadError } = await supabase.rpc('create_or_get_thread_with_origin', {
      other_profile_id: talent_id,
      origin_outreach: outreachRow.id,
      origin_job: job_id ?? null,
    })
    if (threadError || !createdThreadId) {
      // Nothing was delivered yet: demote the orphan tracking row to draft and
      // fail. (RLS has no delete policy on outreach, but hirers can update.)
      await supabase.from('outreach').update({ status: 'draft' }).eq('id', outreachRow.id)
      logEvent('error', 'outreach_thread_error', {
        user_id: user.id,
        code: threadError?.code ?? null,
      })
      return Response.json({ error: 'Failed to start conversation' }, { status: 500 })
    }

    const threadId = createdThreadId as string
    const { error: messageError } = await supabase
      .from('messages')
      .insert({ thread_id: threadId, sender_id: user.id, content: message })
    if (messageError) {
      logEvent('error', 'outreach_message_mirror_error', {
        user_id: user.id,
        code: messageError.code ?? null,
      })
      return Response.json({ error: 'Failed to send message' }, { status: 500 })
    }

    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: user.id,
      event: 'outreach_message_sent',
      properties: { talent_id, has_thread: true },
    })
    void posthog.flush()
    return Response.json({ success: true, thread_id: threadId })
  }

  // Generate: rate limit + daily AI quota BEFORE the OpenAI call
  const hirerContext = cleanOptionalString(parsedBody.body.hirer_context, 1000)
  if (!hirerContext.ok) return badRequest('hirer_context must be 1000 characters or fewer')

  const limited =
    (await enforceRateLimit(`outreach-generate:${user.id}`, 60, 10)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  const skills = (talent.talent_skills as Array<{ skill: string }>).map(s => s.skill)
  try {
    const generated = await generateOutreachMessage({
      hirerContext: hirerContext.value ?? (callerProfile?.full_name ? `from ${callerProfile.full_name}` : 'a casting director'),
      talentName: talent.full_name,
      talentSkills: skills,
      talentBio: talent.bio ?? '',
    })
    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: user.id,
      event: 'outreach_message_generated',
      properties: {
        talent_id,
        talent_skills_count: skills.length,
        has_hirer_context: Boolean(hirerContext.value),
      },
    })
    void posthog.flush()
    return Response.json({ message: generated })
  } catch (err) {
    logEvent('error', 'outreach_openai_error', {
      user_id: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return Response.json({ error: 'Message generation is temporarily unavailable' }, { status: 503 })
  }
}
