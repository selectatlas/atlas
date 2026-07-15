import { AdminDashboard } from '@/components/admin/AdminDashboard'

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-medium">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">Platform health and moderation queue at a glance.</p>
      </div>
      <AdminDashboard />
    </div>
  )
}
