'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { DEMO_APPLICATIONS_STORAGE_KEY, DEMO_JOBS, type DemoApplication } from '@/lib/demo-data'
import { CATEGORY_LABELS } from '@/lib/skills'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export function DemoActivity() {
  const [applications, setApplications] = useState<DemoApplication[]>([])

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(DEMO_APPLICATIONS_STORAGE_KEY)
      // Session storage is the local preview's external state source; hydrate it once on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApplications(saved ? JSON.parse(saved) as DemoApplication[] : [])
    } catch {
      setApplications([])
    }
  }, [])

  return (
    <div className="space-y-8 py-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep track of applications and responses as opportunities move forward.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border border-border/80 p-4 shadow-none"><p className="text-2xl font-bold">{applications.length}</p><p className="mt-1 text-xs text-muted-foreground">Applications sent</p></Card>
        <Card className="border border-border/80 p-4 shadow-none"><p className="text-2xl font-bold">{applications.filter(application => application.status === 'sent').length}</p><p className="mt-1 text-xs text-muted-foreground">Awaiting reply</p></Card>
        <Card className="border border-border/80 p-4 shadow-none"><p className="text-2xl font-bold">{DEMO_JOBS.length}</p><p className="mt-1 text-xs text-muted-foreground">Demo opportunities</p></Card>
      </div>

      {applications.length === 0 ? (
        <Card className="flex min-h-[40vh] flex-col items-center justify-center border border-dashed border-border bg-card px-6 text-center shadow-none">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BriefcaseBusiness className="size-5" /></div>
          <p className="font-medium">Nothing to review yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Apply to a job from Discover and your application will appear here.</p>
          <Link href="/discover" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Find opportunities <ArrowUpRight className="size-3.5" /></Link>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Applications</h2>
          {applications.map(application => {
            const job = DEMO_JOBS.find(item => item.id === application.job_id)
            if (!job) return null
            return (
              <Card key={application.id} className="border border-border/80 p-4 shadow-none">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700"><CheckCircle2 className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-sm">{job.title}</p><Badge variant="outline">{application.status}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{job.hirer?.full_name} · {CATEGORY_LABELS[job.category]} · {job.location}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{application.note || 'Application sent with your profile.'}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
