import Link from 'next/link'
import { BriefcaseBusiness, FilePlus2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_LABELS } from '@/lib/skills'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Job } from '@/types'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: jobs } = user
    ? await supabase
        .from('jobs')
        .select('*')
        .eq('hirer_id', user.id)
        .order('created_at', { ascending: false })
    : { data: null }

  const jobIds = (jobs ?? []).map((j: Job) => j.id)
  const { data: counts } = jobIds.length > 0
    ? await supabase
        .from('applications')
        .select('job_id')
        .in('job_id', jobIds)
    : { data: [] }

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    const c = countMap.get((row as { job_id: string }).job_id) ?? 0
    countMap.set((row as { job_id: string }).job_id, c + 1)
  }

  const jobList = (jobs ?? []) as Job[]

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight">My jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your briefs and keep great talent moving.</p>
        </div>
        <Link href="/jobs/new">
          <Button className="gap-2 rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" />
            Post a job
          </Button>
        </Link>
      </div>

      {jobList.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <p className="font-medium">No jobs posted yet</p>
          <p className="mb-5 mt-1 max-w-sm text-sm text-muted-foreground">Create a brief and start building your shortlist.</p>
          <Link href="/jobs/new">
            <Button className="gap-2 rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
              <FilePlus2 className="size-4" />
              Post your first job
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 card-stagger lg:grid-cols-2">
          {jobList.map(job => {
            const applicantCount = countMap.get(job.id) ?? 0
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="border border-border/80 p-5 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-base leading-tight">{job.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{job.location}{job.budget ? ` · ${job.budget}` : ''}</p>
                    </div>
                    <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className="text-xs shrink-0">
                      {job.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[job.category]}
                    </Badge>
                    <span className={`text-xs font-medium ${applicantCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {applicantCount} {applicantCount === 1 ? 'applicant' : 'applicants'}
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
