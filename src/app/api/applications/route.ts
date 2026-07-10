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

  const { job_id } = await request.json() as { job_id: string }
  if (!job_id) return Response.json({ error: 'job_id required' }, { status: 400 })

  // Verify job exists and is open
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', job_id)
    .single()

  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'open') return Response.json({ error: 'Job is closed' }, { status: 409 })

  const { data: application, error } = await supabase
    .from('applications')
    .insert({ job_id, talent_id: user.id, status: 'sent' })
    .select()
    .single()

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
