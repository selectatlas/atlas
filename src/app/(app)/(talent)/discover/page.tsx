'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BriefcaseBusiness, Check, Grid2X2, List, MapPin, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { DEMO_APPLICATIONS_STORAGE_KEY, DEMO_JOBS, DEMO_PROFILE, type DemoApplication } from '@/lib/demo-data'
import { CATEGORY_LABELS } from '@/lib/skills'
import { getJobMatchReasons } from '@/lib/matching'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { JobBriefDialog } from '@/components/talent/JobBriefDialog'
import { ApplicationPreviewDialog } from '@/components/talent/ApplicationPreviewDialog'
import posthog from 'posthog-js'
import type { Job, Category, Profile, TalentSkill } from '@/types'

type JobResult = Job & { hirer?: { full_name: string } | null }
type SortOption = 'newest' | 'rate_high' | 'rate_low'

export default function DiscoverPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobResult[]>([])
  const [talentProfile, setTalentProfile] = useState<(Profile & { talent_skills: TalentSkill[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [talentCategory, setTalentCategory] = useState<Category | null>(null)
  const [passed, setPassed] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [briefJob, setBriefJob] = useState<JobResult | null>(null)
  const [applicationJob, setApplicationJob] = useState<JobResult | null>(null)
  const [applicationNote, setApplicationNote] = useState('')
  const [advanceAfterApplication, setAdvanceAfterApplication] = useState(false)
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [applicationSuccess, setApplicationSuccess] = useState<JobResult | null>(null)

  useEffect(() => {
    async function load() {
      if (isLocalDemoMode()) {
        setTalentProfile(DEMO_PROFILE)
        setTalentCategory('dancer')
        setJobs(DEMO_JOBS)
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

      const { data: profile } = await supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_WITH_SKILLS)
        .eq('id', user.id)
        .single()

      const talent = profile as unknown as Profile & { talent_skills: TalentSkill[] }
      setTalentProfile(talent)
      const skills = talent.talent_skills ?? []
      const primaryCategory = skills[0]?.category ?? null
      setTalentCategory(primaryCategory)

      let query = supabase
        .from('jobs')
        .select('*, profiles!hirer_id(full_name)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })

      if (primaryCategory) {
        query = query.eq('category', primaryCategory)
      }

      const { data: jobData } = await query
      setJobs((jobData ?? []) as JobResult[])
      setLoading(false)
    }
    load()
  }, [router])

  const visibleJobs = useMemo(() => {
    let filtered = jobs.filter(j => !passed.has(j.id))

    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      )
    }

    filtered = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'rate_high': {
          const aRate = parseBudget(a.budget)
          const bRate = parseBudget(b.budget)
          return bRate - aRate
        }
        case 'rate_low': {
          const aRate = parseBudget(a.budget)
          const bRate = parseBudget(b.budget)
          return aRate - bRate
        }
      }
    })

    return filtered
  }, [jobs, passed, search, sort])

  function buildApplicationNote(job: JobResult) {
    const firstName = talentProfile?.full_name.split(' ')[0] ?? 'there'
    const matchingSkill = job.skills_required.find(required => talentProfile?.talent_skills.some(skill => {
      const currentSkill = skill.skill.toLowerCase()
      const requiredSkill = required.toLowerCase()
      return currentSkill.includes(requiredSkill) || requiredSkill.includes(currentSkill)
    }))
    return `Hi, I'm ${firstName}. I'd love to be considered for ${job.title}${matchingSkill ? ` — my experience in ${matchingSkill} feels like a strong fit` : ''}. Thanks for taking a look at my profile.`
  }

  function requestApplication(job: JobResult, shouldAdvance = false) {
    if (applied.has(job.id) || applyingId) return
    setDragX(0)
    setApplicationError(null)
    setAdvanceAfterApplication(shouldAdvance)
    setApplicationNote(buildApplicationNote(job))
    setApplicationJob(job)
  }

  async function submitApplication(jobId: string, note: string) {
    if (applied.has(jobId) || applyingId) return false
    setApplyingId(jobId)

    if (isLocalDemoMode()) {
      const application: DemoApplication = {
        id: `demo-application-${jobId}`,
        job_id: jobId,
        note: note.trim(),
        status: 'sent',
        created_at: new Date().toISOString(),
      }
      try {
        const existing = window.sessionStorage.getItem(DEMO_APPLICATIONS_STORAGE_KEY)
        const applications = existing ? JSON.parse(existing) as DemoApplication[] : []
        const next = [application, ...applications.filter(item => item.job_id !== jobId)]
        window.sessionStorage.setItem(DEMO_APPLICATIONS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        setApplicationError('Your application could not be saved in this preview.')
        setApplyingId(null)
        return false
      }
      setApplied(prev => new Set([...prev, jobId]))
      setApplyingId(null)
      return true
    }

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, note: note.trim() }),
      })
      if (res.ok) {
        setApplied(prev => new Set([...prev, jobId]))
        return true
      }
      const data = await res.json().catch(() => null) as { error?: string } | null
      setApplicationError(data?.error ?? 'Your application could not be sent. Please try again.')
      return false
    } catch {
      setApplicationError('Network error. Your application has not been sent.')
      return false
    } finally {
      setApplyingId(null)
    }
  }

  async function confirmApplication() {
    if (!applicationJob) return
    const job = applicationJob
    const success = await submitApplication(job.id, applicationNote)
    if (!success) return
    setApplicationJob(null)
    setApplicationSuccess(job)
    if (advanceAfterApplication) setDragX(0)
    window.setTimeout(() => setApplicationSuccess(current => current?.id === job.id ? null : current), 5000)
  }

  function passJob(jobId: string) {
    setPassed(prev => new Set([...prev, jobId]))
    setDragX(0)
    posthog.capture('job_passed', { job_id: jobId })
  }

  const pointerId = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startTime = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  function onDragStart(e: React.PointerEvent) {
    if (pointerId.current !== null) return
    pointerId.current = e.pointerId
    cardRef.current?.setPointerCapture(e.pointerId)
    startXRef.current = e.clientX
    startTime.current = e.timeStamp
    setDragging(true)
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragging || pointerId.current !== e.pointerId) return
    const raw = e.clientX - startXRef.current
    setDragX(raw > 0 ? raw : raw * 0.3)
  }
  function onDragEnd(e: React.PointerEvent) {
    if (!dragging) return
    pointerId.current = null
    setDragging(false)
    const elapsed = e.timeStamp - startTime.current
    const currentJob = current
    if (!currentJob) { setDragX(0); return }
    if (elapsed > 0) {
      const velocity = Math.abs(dragX) / elapsed
      if (dragX > 80 || (dragX > 20 && velocity > 0.3)) { requestApplication(currentJob, true); return }
      if (dragX < -80 || (dragX < -20 && velocity > 0.3)) { passJob(currentJob.id); return }
    }
    setDragX(0)
  }

  const swipeJobs = visibleJobs.filter(job => !applied.has(job.id))
  const current = swipeJobs[0]
  const next = swipeJobs[1]
  const reviewedCount = passed.size + applied.size
  const progressPosition = Math.min(reviewedCount + 1, Math.max(jobs.length, 1))
  const hasJobsForView = viewMode === 'swipe' ? swipeJobs.length > 0 : visibleJobs.length > 0
  const rotation = dragging ? dragX * 0.06 : 0
  const isRight = dragX > 40
  const isLeft = dragX < -40

  if (loading) {
    return (
      <div className="space-y-6 py-2">
        <Skeleton className="h-7 rounded-xl w-1/2" />
        <div className="border rounded-3xl h-[460px] overflow-hidden">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="p-6 space-y-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-7 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <div className="space-y-2 mt-4">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your opportunities</p>
          <h1 className="text-2xl font-semibold tracking-tight">Discover jobs</h1>
          {talentCategory && (
            <p className="mt-1 text-sm text-muted-foreground">Matched for {CATEGORY_LABELS[talentCategory]}</p>
          )}
          {isLocalDemoMode() && (
            <p className="mt-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Local demo mode</p>
          )}
        </div>
        {visibleJobs.length > 0 && (
          <div className="flex gap-0.5 rounded-lg bg-muted p-1">
            {(['swipe', 'list'] as const).map(mode => (
              <button
                type="button"
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] ${
                  viewMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'swipe' ? <Grid2X2 className="size-3.5" /> : <List className="size-3.5" />}
                <span>{mode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search bar + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear job search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortOption)}
          aria-label="Sort jobs"
          className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="newest">Newest</option>
          <option value="rate_high">Rate ↑</option>
          <option value="rate_low">Rate ↓</option>
        </select>
      </div>

      {!hasJobsForView ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BriefcaseBusiness className="size-5" /></div>
          <p className="font-medium">
            {search.trim()
              ? 'No jobs match your search'
              : jobs.length === 0
                ? 'No open jobs yet'
                : "You've reviewed all jobs"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Check back soon for new opportunities.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3 card-stagger">
          {visibleJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              applied={applied.has(job.id)}
              applying={applyingId === job.id}
              onApply={() => requestApplication(job)}
              onViewBrief={() => setBriefJob(job)}
              onPass={() => passJob(job.id)}
            />
          ))}
        </div>
      ) : (
        <div className="pb-20">
          <div className="relative select-none h-[460px]">
            {next && (
              <div
                className="absolute inset-0 bg-card border rounded-3xl overflow-hidden"
                style={{ transform: 'scale(0.95)', transformOrigin: 'bottom center', zIndex: 1 }}
              >
                <JobCardContent job={next} matchReasons={getJobMatchReasons(next, talentProfile)} onViewBrief={() => setBriefJob(next)} />
              </div>
            )}

            {current && (
              <div
                ref={cardRef}
                className="absolute inset-0 bg-card border rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing shadow-2xl"
                style={{
                  transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
                  transition: dragging ? 'none' : 'transform 0.3s ease',
                  zIndex: 2,
                  touchAction: 'none',
                }}
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              >
                <JobCardContent job={current} matchReasons={getJobMatchReasons(current, talentProfile)} onViewBrief={() => setBriefJob(current)} />

                {isRight && (
                  <div className="absolute inset-0 bg-accent/20 flex items-center justify-center rounded-3xl">
                    <div className="bg-accent text-accent-foreground text-2xl font-bold px-6 py-3 rounded-2xl border-4 border-accent rotate-[-15deg]">
                      APPLY
                    </div>
                  </div>
                )}
                {isLeft && (
                  <div className="absolute inset-0 bg-muted/60 flex items-center justify-center rounded-3xl">
                    <div className="bg-muted text-muted-foreground text-2xl font-bold px-6 py-3 rounded-2xl border-4 border-border rotate-[15deg]">
                      PASS
                    </div>
                  </div>
                )}
              </div>
            )}

            {current && (
              <div className="absolute top-3 right-3 z-20 bg-background/70 backdrop-blur-sm text-muted-foreground text-xs px-2.5 py-1 rounded-full">
                {progressPosition} / {Math.max(jobs.length, 1)}
              </div>
            )}
          </div>

          {current && (
            <div className="flex items-center justify-center gap-6 mt-4">
              <button
                type="button"
                onClick={() => passJob(current.id)}
                className="flex size-14 items-center justify-center rounded-full border bg-muted text-muted-foreground shadow-sm transition-[border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-muted-foreground/30 hover:text-foreground active:scale-[0.97]"
                aria-label="Pass on job"
              >
                <X className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => requestApplication(current, true)}
                disabled={applyingId === current.id || applied.has(current.id)}
                className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60"
                aria-label="Apply to job"
              >
                {applyingId === current.id ? '...' : <Check className="size-5" />}
              </button>
            </div>
          )}
        </div>
      )}

      {applicationSuccess && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-card p-4 shadow-lg md:bottom-6">
          <div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><Check className="size-4" /></div><div><p className="text-sm font-semibold">Application sent</p><p className="mt-0.5 text-xs text-muted-foreground">{applicationSuccess.title} is now in your Activity.</p></div></div>
          <a href="/home" className="shrink-0 text-xs font-semibold text-primary hover:underline">View dashboard</a>
        </div>
      )}

      <JobBriefDialog
        job={briefJob}
        matchReasons={briefJob ? getJobMatchReasons(briefJob, talentProfile) : []}
        applied={briefJob ? applied.has(briefJob.id) : false}
        onClose={() => setBriefJob(null)}
        onApply={() => {
          if (!briefJob) return
          const job = briefJob
          setBriefJob(null)
          requestApplication(job)
        }}
      />

      <ApplicationPreviewDialog
        job={applicationJob}
        profile={talentProfile}
        note={applicationNote}
        submitting={Boolean(applicationJob && applyingId === applicationJob.id)}
        error={applicationError}
        onNoteChange={setApplicationNote}
        onClose={() => { setApplicationJob(null); setApplicationError(null); setDragX(0) }}
        onConfirm={confirmApplication}
      />
    </div>
  )
}

function JobCardContent({ job, matchReasons, onViewBrief }: { job: JobResult; matchReasons: string[]; onViewBrief: () => void }) {
  const hirer = job.hirer as { full_name: string } | null
  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-3">
        <Badge variant="outline" className="text-xs">
          {CATEGORY_LABELS[job.category]}
        </Badge>
      </div>
      <h2 className="text-xl font-bold leading-tight mb-2">{job.title}</h2>
      {hirer && <p className="text-muted-foreground text-sm mb-3">Posted by {hirer.full_name}</p>}
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
        <MapPin className="size-4 shrink-0" strokeWidth={1.5} />
        {job.location}
        {job.budget && <span className="text-muted-foreground/70">· {job.budget}</span>}
      </div>
      {matchReasons.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {matchReasons.slice(0, 2).map(reason => <Badge key={reason} variant="secondary" className="text-[11px]">{reason}</Badge>)}
        </div>
      )}
      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-5 flex-1">{job.description}</p>
      {job.skills_required.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {job.skills_required.slice(0, 4).map(s => (
            <Badge key={s} variant="secondary" className="text-xs">
              {s}
            </Badge>
          ))}
        </div>
      )}
      <button type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onViewBrief() }} className="mt-4 self-start text-xs font-semibold text-primary hover:underline">
        View full brief →
      </button>
    </div>
  )
}

function JobCard({
  job, applied, applying, onApply, onViewBrief, onPass,
}: {
  job: JobResult
  applied: boolean
  applying: boolean
  onApply: () => void
  onViewBrief: () => void
  onPass: () => void
}) {
  const hirer = job.hirer as { full_name: string } | null
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight">{job.title}</h3>
          {hirer && <p className="text-muted-foreground text-xs mt-0.5">by {hirer.full_name} · {job.location}</p>}
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {CATEGORY_LABELS[job.category]}
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{job.description}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="flex-1" onClick={onPass}>
          Pass
        </Button>
        <Button variant="ghost" className="px-3" onClick={onViewBrief} aria-label={`View full brief for ${job.title}`}>
          Brief
        </Button>
        <Button
          onClick={onApply}
          disabled={applying || applied}
          className={`flex-1 rounded-xl font-semibold ${
            applied
              ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-50'
              : 'bg-accent text-accent-foreground hover:bg-accent/80'
          }`}
        >
          {applying ? 'Applying...' : applied ? 'Applied' : 'Apply'}
        </Button>
      </div>
    </Card>
  )
}

function parseBudget(budget: string | null): number {
  if (!budget) return 0
  const match = budget.match(/[\d,]+/)
  if (!match) return 0
  return parseInt(match[0].replace(/,/g, ''), 10)
}
