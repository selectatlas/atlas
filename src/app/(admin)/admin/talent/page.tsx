import { AdminAddTalentPanel } from '@/components/admin/AdminAddTalentPanel'

export default function AdminAddTalentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-medium">Add talent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Onboard talent to the platform. They can set a password via forgot-password on first sign-in.
        </p>
      </div>
      <AdminAddTalentPanel />
    </div>
  )
}
