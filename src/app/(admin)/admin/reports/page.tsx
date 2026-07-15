import { AdminReportsPanel } from '@/components/admin/AdminReportsPanel'

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-medium">Reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review abuse reports filed by hirers and talent.</p>
      </div>
      <AdminReportsPanel />
    </div>
  )
}
