import { createClient } from '@/lib/supabase/server'
import type { ApplicationStatus } from '@/types'

const VALID_STATUSES: ApplicationStatus[] = ['sent', 'viewed', 'responded', 'shortlisted', 'hired']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch application and verify hirer owns the job
  const { data: application } = await supabase
    .from('applications')
    .select('id, job_id, jobs!job_id(hirer_id)')
    .eq('id', id)
    .single()

  if (!application) return Response.json({ error: 'Not found' }, { status: 404 })

  const job = application.jobs as unknown as { hirer_id: string } | null
  if (job?.hirer_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { status } = await request.json() as { status: ApplicationStatus }
  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 })
  return Response.json({ application: updated })
}
