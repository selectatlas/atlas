import { AdminAccountsPanel } from '@/components/admin/AdminAccountsPanel'

export default function AdminAccountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-medium">Accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone who has signed up. Change roles, filter by account type, and suspend bad actors.
        </p>
      </div>
      <AdminAccountsPanel />
    </div>
  )
}
