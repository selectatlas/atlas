import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single()

  if (profile?.account_type !== 'talent') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { job_id, note } = await request.json() as { job_id: string; note?: string }
  if (!job_id) return Response.json({ error: 'job_id required' }, { status: 400 })
  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 1000) : null

  // Verify job exists and is open
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', job_id)
    .single()

  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'open') return Response.json({ error: 'Job is closed' }, { status: 409 })

  const applicationPayload = { job_id, talent_id: user.id, status: 'sent', note: trimmedNote }
  let { data: application, error } = await supabase
    .from('applications')
    .insert(applicationPayload)
    .select()
    .single()

  // Keep existing deployments working until the optional note migration is applied.
  if (error?.code === '42703' && trimmedNote) {
    const fallback = await supabase
      .from('applications')
      .insert({ job_id, talent_id: user.id, status: 'sent' })
      .select()
      .single()
    application = fallback.data
    error = fallback.error
  }

  if (error) {
    // unique constraint violation = already applied
    if (error.code === '23505') {
      return Response.json({ error: 'Already applied' }, { status: 409 })
    }
    console.error('Application insert error:', error)
    return Response.json({ error: 'Failed to apply' }, { status: 500 })
  }

  return Response.json({ application }, { status: 201 })
}
