import { requirePlatformAdmin } from '@/lib/platform-admin'

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return auth.response

  const { service } = auth

  const [
    profiles,
    jobs,
    applications,
    outreach,
    messages,
    openReports,
    suspendedUsers,
    removedJobs,
  ] = await Promise.all([
    service.from('profiles').select('id', { count: 'exact', head: true }),
    service.from('jobs').select('id', { count: 'exact', head: true }),
    service.from('applications').select('id', { count: 'exact', head: true }),
    service.from('outreach').select('id', { count: 'exact', head: true }),
    service.from('messages').select('id', { count: 'exact', head: true }),
    service.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    service.from('profiles').select('id', { count: 'exact', head: true }).not('suspended_at', 'is', null),
    service.from('jobs').select('id', { count: 'exact', head: true }).not('removed_at', 'is', null),
  ])

  const { count: hirerCount } = await service
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('account_type', 'hirer')

  const { count: talentCount } = await service
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('account_type', 'talent')

  return Response.json({
    metrics: {
      users_total: profiles.count ?? 0,
      hirers: hirerCount ?? 0,
      talent: talentCount ?? 0,
      jobs: jobs.count ?? 0,
      applications: applications.count ?? 0,
      outreach: outreach.count ?? 0,
      messages: messages.count ?? 0,
      open_reports: openReports.count ?? 0,
      suspended_users: suspendedUsers.count ?? 0,
      removed_jobs: removedJobs.count ?? 0,
    },
  })
}
