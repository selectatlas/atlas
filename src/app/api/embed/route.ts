import { createClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/openai'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { parseJsonBody, isUuid, badRequest } from '@/lib/validation'
import { enforceRateLimit, enforceAiQuota } from '@/lib/rate-limit'
import { logEvent } from '@/lib/log'

// POST /api/embed — regenerate the embedding for YOUR OWN profile.
// Called after profile or skills are updated. Nobody (including hirers) may
// regenerate another user's embedding.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { profile_id } = parsedBody.body

  if (profile_id !== undefined && !isUuid(profile_id)) {
    return badRequest('profile_id must be a valid id')
  }
  const targetId = (profile_id as string | undefined) ?? user.id

  // Only your own profile - embeddings are derived data owned by the profile owner
  if (targetId !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit + daily AI quota BEFORE any OpenAI spend
  const limited =
    (await enforceRateLimit(`embed:${user.id}`, 3600, 10)) ??
    (await enforceAiQuota(user.id))
  if (limited) return limited

  // Fetch profile + skills
  const { data: profile } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .eq('id', targetId)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const skills = (profile.talent_skills as Array<{ skill: string; category: string }>)
  const skillNames = skills.map(s => s.skill).join(', ')
  const categories = [...new Set(skills.map(s => s.category))].join(', ')

  // Concatenate searchable text (same format as seed)
  const sourceText = [
    profile.full_name,
    categories,
    skillNames,
    profile.city ?? '',
    profile.country ?? '',
    profile.bio ?? '',
  ].filter(Boolean).join('. ')

  // Generate embedding
  let embedding: number[]
  try {
    embedding = await embedText(sourceText)
  } catch (err) {
    logEvent('error', 'profile_embedding_error', {
      user_id: user.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return Response.json({ error: 'Embedding generation failed' }, { status: 503 })
  }

  // Upsert using service client (bypasses RLS)
  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('profile_embeddings')
    .upsert({
      profile_id: targetId,
      embedding,
      source_text: sourceText,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    logEvent('error', 'profile_embedding_upsert_error', { user_id: user.id, code: error.code ?? null })
    return Response.json({ error: 'Failed to store embedding' }, { status: 500 })
  }

  return Response.json({ success: true })
}
