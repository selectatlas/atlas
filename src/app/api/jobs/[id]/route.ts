import { createClient } from '@/lib/supabase/server'
import { parseJsonBody, isUuid } from '@/lib/validation'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !job) return Response.json({ error: 'Not found' }, { status: 404 })
  if (job.hirer_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data: applications } = await supabase
    .from('applications')
    .select('*, profiles!talent_id(id, full_name, avatar_url, city, country, talent_skills(*))')
    .eq('job_id', id)
    .order('created_at', { ascending: false })

  return Response.json({ job, applications: applications ?? [] })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase
    .from('jobs')
    .select('hirer_id')
    .eq('id', id)
    .single()

  if (!job) return Response.json({ error: 'Not found' }, { status: 404 })
  if (job.hirer_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const parsedBody = await parseJsonBody(request)
  if (!parsedBody.ok) return parsedBody.response
  const { status } = parsedBody.body
  if (status !== 'open' && status !== 'closed') {
    return Response.json({ error: 'status must be open or closed' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 })
  return Response.json({ job: updated })
}
