import { AdminJobsPanel } from '@/components/admin/AdminJobsPanel'

export default function AdminJobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-medium">Jobs</h2>
        <p className="mt-1 text-sm text-muted-foreground">Post jobs on behalf of hirers and moderate listings.</p>
      </div>
      <AdminJobsPanel />
    </div>
  )
}
