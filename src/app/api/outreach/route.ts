import { createClient } from '@/lib/supabase/server'
import { generateOutreachMessage } from '@/lib/openai'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    talent_id: string
    hirer_context?: string
    action: 'generate' | 'send'
    message?: string
  }

  const { talent_id, hirer_context, action, message } = body

  if (action === 'send') {
    if (!message) return Response.json({ error: 'message required' }, { status: 400 })
    const { error } = await supabase.from('outreach').insert({
      hirer_id: user.id,
      talent_id,
      message,
      status: 'sent',
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  // Generate: fetch talent profile and build personalised message
  const { data: talent } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_WITH_SKILLS)
    .eq('id', talent_id)
    .single()

  if (!talent) return Response.json({ error: 'Talent not found' }, { status: 404 })

  const { data: hirerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const skills = (talent.talent_skills as Array<{ skill: string }>).map(s => s.skill)
  const generated = await generateOutreachMessage({
    hirerContext: hirer_context ?? (hirerProfile?.full_name ? `from ${hirerProfile.full_name}` : 'a casting director'),
    talentName: talent.full_name,
    talentSkills: skills,
    talentBio: talent.bio ?? '',
  })

  return Response.json({ message: generated })
}
