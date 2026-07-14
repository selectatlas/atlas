import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/validation'
import { EMPTY_TALENT_ATTRIBUTES, validateTalentAttributesPayload } from '@/lib/talent-profile-attributes'
import { enforceRateLimit } from '@/lib/rate-limit'

async function getTalentCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
  if (profile?.account_type !== 'talent') return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const caller = await getTalentCaller()
  if ('response' in caller) return caller.response

  const service = createServiceClient()
  const [{ data: attributes }, { data: sensitive }] = await Promise.all([
    service.from('talent_profiles').select('*').eq('profile_id', caller.user.id).maybeSingle(),
    service.from('talent_sensitive_preferences').select('preferences').eq('profile_id', caller.user.id).maybeSingle(),
  ])

  return Response.json({
    attributes: {
      ...EMPTY_TALENT_ATTRIBUTES,
      ...(attributes ?? {}),
      sensitive_preferences: sensitive?.preferences ?? {},
    },
  })
}

export async function PATCH(request: Request) {
  const caller = await getTalentCaller()
  if ('response' in caller) return caller.response

  const limited = await enforceRateLimit(`profile-attributes:${caller.user.id}`, 60, 20)
  if (limited) return limited

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const parsed = validateTalentAttributesPayload(parsedBody.body)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const { sensitive_preferences, ...attributes } = parsed.value
  const service = createServiceClient()
  const [{ error: attributesError }, { error: sensitiveError }] = await Promise.all([
    service.from('talent_profiles').upsert({ profile_id: caller.user.id, ...attributes }, { onConflict: 'profile_id' }),
    service.from('talent_sensitive_preferences').upsert({ profile_id: caller.user.id, preferences: sensitive_preferences }, { onConflict: 'profile_id' }),
  ])

  if (attributesError || sensitiveError) {
    return Response.json({ error: 'Unable to save profile attributes' }, { status: 500 })
  }
  return Response.json({ attributes: parsed.value })
}
