import { Suspense } from 'react'
import { SettingsPage } from '@/components/settings/SettingsPage'

export default function SettingsRoutePage() {
  return (
    <Suspense fallback={<div className="py-8 text-sm text-muted-foreground">Loading settings…</div>}>
      <SettingsPage />
    </Suspense>
  )
}
