'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ApplicationRow, type ApplicationRowData } from '@/components/talent/ApplicationRow'
import { DEMO_APPLICATIONS_STORAGE_KEY, DEMO_JOBS, type DemoApplication } from '@/lib/demo-data'

// Demo mode stores applications in sessionStorage (see discover/page.tsx),
// so the server-side applications page cannot see them; this client list is
// the demo-mode equivalent.
export function DemoApplicationsList() {
  const [applications, setApplications] = useState<ApplicationRowData[] | null>(null)

  useEffect(() => {
    let stored: DemoApplication[] = []
    try {
      const raw = window.sessionStorage.getItem(DEMO_APPLICATIONS_STORAGE_KEY)
      stored = raw ? JSON.parse(raw) as DemoApplication[] : []
    } catch { /* corrupt storage reads as empty */ }

    // Session storage is the local preview's external state source; hydrate it once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplications(stored.map(app => {
      const job = DEMO_JOBS.find(j => j.id === app.job_id) ?? null
      return {
        id: app.id,
        status: app.status,
        created_at: app.created_at,
        note: app.note || null,
        job: job ? { id: job.id, title: job.title, category: job.category, location: job.location, removed: false } : null,
      }
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
  }, [])

  if (applications === null) return null

  return (
    <div className="space-y-6 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">{applications.length} {applications.length === 1 ? 'application' : 'applications'} submitted.</p>
      </div>

      {applications.length === 0 ? (
        <Card className="flex min-h-[32vh] flex-col items-center justify-center border border-dashed border-border bg-card px-6 text-center shadow-none">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Send className="size-5" />
          </div>
          <p className="font-medium">No applications yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When you apply for jobs, they show up here so you can track where each one stands.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Discover jobs
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {applications.map(application => (
            <ApplicationRow key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  )
}
