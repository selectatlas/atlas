import { createClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/openai'
import type { Category } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single()

  if (profile?.account_type !== 'hirer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as {
    title: string
    description: string
    category: Category
    skills_required: string[]
    location: string
    budget: string
  }

  const { title, description, category, skills_required, location, budget } = body

  if (!title?.trim() || !description?.trim() || !category || !location?.trim()) {
    return Response.json({ error: 'title, description, category, and location are required' }, { status: 400 })
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      hirer_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      skills_required: skills_required ?? [],
      location: location.trim(),
      budget: budget?.trim() || null,
      status: 'open',
    })
    .select()
    .single()

  if (error || !job) {
    console.error('Job insert error:', error)
    return Response.json({ error: 'Failed to create job' }, { status: 500 })
  }

  // Embed job description in background (non-blocking for UX)
  const embedText_ = `${title} ${description} ${(skills_required ?? []).join(' ')}`
  embedText(embedText_)
    .then(embedding => {
      const service = createServiceClient()
      return service.from('job_embeddings').upsert({ job_id: job.id, embedding, updated_at: new Date().toISOString() })
    })
    .catch(err => console.error('Job embedding error:', err))

  return Response.json({ job }, { status: 201 })
}
