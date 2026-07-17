'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, Clock3, MapPin, Plane, ShieldCheck, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { DEMO_APPLICATIONS_STORAGE_KEY, DEMO_JOBS, DEMO_PROFILE, type DemoApplication } from '@/lib/demo-data'
import { CATEGORY_LABELS } from '@/lib/skills'
import { buildApplicationNote, getJobMatchReasons, getJobMeta } from '@/lib/matching'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SafetyActions } from '@/components/safety/SafetyActions'
import { ApplicationPreviewDialog } from '@/components/talent/ApplicationPreviewDialog'
import { JobCover } from '@/components/talent/JobCover'
import type { Job, Profile, TalentSkill } from '@/types'

type JobResult = Job & { hirer?: { full_name: string } | null }
type TalentProfile = Profile & { talent_skills: TalentSkill[] }

export default function JobDetailPage() {
  const params = useParams<{ id: string }>()
  const jobId = params.id
  const router = useRouter()
  const [job, setJob] = useState<JobResult | null>(null)
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [applied, setApplied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applicationJob, setApplicationJob] = useState<JobResult | null>(null)
  const [applicationNote, setApplicationNote] = useState('')
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [applicationSent, setApplicationSent] = useState(false)

  useEffect(() => {
    async function load() {
      if (isLocalDemoMode()) {
        setJob(DEMO_JOBS.find(demoJob => demoJob.id === jobId) ?? null)
        setTalentProfile(DEMO_PROFILE)
        try {
          const existing = window.sessionStorage.getItem(DEMO_APPLICATIONS_STORAGE_KEY)
          const applications = existing ? JSON.parse(existing) as DemoApplication[] : []
          setApplied(applications.some(application => application.job_id === jobId))
        } catch {
          setApplied(false)
        }
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        router.push('/login')
        return
      }

      const [{ data: profile }, { data: jobData }, { data: application }] = await Promise.all([
        supabase.from('profiles').select(PUBLIC_PROFILE_WITH_SKILLS).eq('id', user.id).single(),
        supabase.from('jobs').select('*, hirer:profiles!hirer_id(full_name)').eq('id', jobId).is('removed_at', null).maybeSingle(),
        supabase.from('applications').select('id').eq('job_id', jobId).eq('talent_id', user.id).maybeSingle(),
      ])

      setTalentProfile(profile as unknown as TalentProfile)
      setJob((jobData as JobResult | null) ?? null)
      setApplied(Boolean(application))
      setLoading(false)
    }
    load()
  }, [jobId, router])

  function requestApplication() {
    if (!job || applied || applying) return
    setApplicationError(null)
    setApplicationNote(buildApplicationNote(job, talentProfile))
    setApplicationJob(job)
  }

  async function confirmApplication() {
    if (!applicationJob) return
    setApplying(true)

    if (isLocalDemoMode()) {
      const application: DemoApplication = {
        id: `demo-application-${applicationJob.id}`,
        job_id: applicationJob.id,
        note: applicationNote.trim(),
        status: 'sent',
        created_at: new Date().toISOString(),
      }
      try {
        const existing = window.sessionStorage.getItem(DEMO_APPLICATIONS_STORAGE_KEY)
        const applications = existing ? JSON.parse(existing) as DemoApplication[] : []
        const next = [application, ...applications.filter(item => item.job_id !== applicationJob.id)]
        window.sessionStorage.setItem(DEMO_APPLICATIONS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        setApplicationError('Your application could not be saved in this preview.')
        setApplying(false)
        return
      }
      setApplied(true)
      setApplying(false)
      setApplicationJob(null)
      setApplicationSent(true)
      return
    }

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: applicationJob.id, note: applicationNote.trim() }),
      })
      if (res.ok) {
        setApplied(true)
        setApplicationJob(null)
        setApplicationSent(true)
        return
      }
      const data = await res.json().catch(() => null) as { error?: string } | null
      setApplicationError(data?.error ?? 'Your application could not be sent. Please try again.')
    } catch {
      setApplicationError('Network error. Your application has not been sent.')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-2">
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
        <Skeleton className="h-9 w-3/4 rounded-md" />
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <Skeleton className="h-80 rounded-xl lg:col-start-2 lg:row-start-1" />
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BriefcaseBusiness className="size-5" /></div>
        <p className="font-medium">This job is no longer available</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been filled or removed by the hirer.</p>
        <Button render={<Link href="/discover" />} variant="outline" className="mt-5 rounded-xl">
          Back to Discover
        </Button>
      </div>
    )
  }

  const meta = getJobMeta(job)
  const matchReasons = getJobMatchReasons(job, talentProfile)
  const isOpen = job.status === 'open'
  const postedDate = new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <Link href="/discover" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to Discover
      </Link>

      <JobCover
        coverUrl={job.cover_url}
        category={job.category}
        title={job.title}
        sizes="(min-width: 1024px) 1024px, 100vw"
        className="aspect-[21/9] rounded-2xl"
      />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{CATEGORY_LABELS[job.category]}</Badge>
          {meta.workTypeLabel && <Badge variant="secondary">{meta.workTypeLabel}</Badge>}
          {!isOpen && <Badge variant="secondary" className="bg-muted text-muted-foreground">Closed</Badge>}
        </div>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{job.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" strokeWidth={1.5} />{job.hirer?.full_name ?? 'Creative team'}</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" strokeWidth={1.5} />Posted {postedDate}</span>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        {/* Sticky action card: first on mobile, right column on desktop */}
        <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rate</p>
                <p className="text-lg font-semibold">{job.budget ?? 'Rate on application'}</p>
              </div>
              <Badge variant={isOpen ? 'default' : 'secondary'}>{isOpen ? 'Open' : 'Closed'}</Badge>
            </div>

            <div className="space-y-2">
              {meta.dateLabel && <MetaItem icon={CalendarDays} label="Dates" value={meta.dateLabel} />}
              {meta.deadlineLabel && <MetaItem icon={CalendarDays} label="Apply by" value={meta.deadlineLabel} />}
              <MetaItem icon={MapPin} label="Location" value={job.location} />
              {job.duration && <MetaItem icon={Clock3} label="Duration" value={job.duration} />}
              {job.travel_required !== null && job.travel_required !== undefined && (
                <MetaItem icon={Plane} label="Travel" value={job.travel_required ? 'Travel may be required' : 'No travel expected'} />
              )}
              {job.usage_rights && <MetaItem icon={ShieldCheck} label="Usage" value={job.usage_rights} />}
            </div>

            <Button
              onClick={requestApplication}
              disabled={applied || applying || !isOpen}
              className="w-full rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent/80"
            >
              {applied ? 'Applied' : isOpen ? 'Apply to this job' : 'Applications closed'}
            </Button>
            <p className="text-xs text-muted-foreground">
              {applied
                ? 'Your application is with the hirer. Track the outcome from Activity.'
                : isOpen
                  ? 'You can review and edit your application before it is sent.'
                  : 'This job is closed to new applications.'}
            </p>
          </Card>
        </aside>

        {/* Main column: narrative content */}
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          {matchReasons.length > 0 && (
            <Card className="border-primary/20 bg-primary/5 p-4 shadow-none">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Why this fits you</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {matchReasons.map(reason => <Badge key={reason} variant="secondary">{reason}</Badge>)}
              </div>
            </Card>
          )}

          <section>
            <h2 className="text-sm font-semibold">The brief</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{job.description}</p>
          </section>

          {job.skills_required.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold">What they are looking for</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.skills_required.map(skill => <Badge key={skill} variant="outline">{skill}</Badge>)}
              </div>
            </section>
          )}

          <SafetyActions jobId={job.id} subjectLabel={job.title} />
        </div>
      </div>

      {applicationSent && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-card p-4 shadow-lg md:bottom-6">
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><Check className="size-4" /></div>
            <div>
              <p className="text-sm font-semibold">Application sent</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{job.title} is now in your Activity.</p>
            </div>
          </div>
          <a href="/home" className="shrink-0 text-xs font-semibold text-primary hover:underline">View dashboard</a>
        </div>
      )}

      <ApplicationPreviewDialog
        job={applicationJob}
        profile={talentProfile}
        note={applicationNote}
        submitting={applying}
        error={applicationError}
        onNoteChange={setApplicationNote}
        onClose={() => { setApplicationJob(null); setApplicationError(null) }}
        onConfirm={confirmApplication}
      />
    </div>
  )
}

function MetaItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
