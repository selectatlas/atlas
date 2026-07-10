import { createClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/openai'

// POST /api/embed — regenerate embedding for a talent profile
// Called after profile or skills are updated
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { profile_id } = await request.json() as { profile_id?: string }
  const targetId = profile_id ?? user.id

  // Only allow embedding your own profile
  if (targetId !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .single()
    if (profile?.account_type !== 'hirer') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Fetch profile + skills
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, talent_skills(*)')
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
    console.error('Embedding generation failed:', err)
    return Response.json({ error: 'Embedding generation failed' }, { status: 500 })
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
    console.error('Embedding upsert failed:', error)
    return Response.json({ error: 'Failed to store embedding' }, { status: 500 })
  }

  return Response.json({ success: true })
}
