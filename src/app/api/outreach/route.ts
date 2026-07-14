import { createClient } from '@/lib/supabase/server'
import { generateOutreachMessage } from '@/lib/openai'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { parseJsonBody, isUuid, cleanString, cleanOptionalString, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { talent_id, action } = parsedBody.body

  if (!isUuid(talent_id)) return badRequest('talent_id must be a valid id')
  if (action !== 'generate' && action !== 'send') {
    return badRequest('action must be generate or send')
  }

  // Outreach is a hirer feature - reject cross-role calls before any spend
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('account_type, full_name')
    .eq('id', user.id)
    .single()
  if (callerProfile?.account_type !== 'hirer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

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

    const { error } = await supabase.from('outreach').insert({
      hirer_id: user.id,
      talent_id,
      message,
      status: 'sent',
    })
    if (error) {
      logEvent('error', 'outreach_insert_error', { user_id: user.id, code: error.code ?? null })
      return Response.json({ error: 'Failed to send outreach' }, { status: 500 })
    }
    return Response.json({ success: true })
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
      hirerContext: hirerContext.value ?? (callerProfile.full_name ? `from ${callerProfile.full_name}` : 'a casting director'),
      talentName: talent.full_name,
      talentSkills: skills,
      talentBio: talent.bio ?? '',
    })
    return Response.json({ message: generated })
  } catch (err) {
    logEvent('error', 'outreach_openai_error', {
      user_id: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return Response.json({ error: 'Message generation is temporarily unavailable' }, { status: 503 })
  }
}
