'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BriefcaseBusiness, Check, Layers, LayoutGrid, List, MapPin, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { DEMO_APPLICATIONS_STORAGE_KEY, DEMO_JOBS, DEMO_PROFILE, type DemoApplication } from '@/lib/demo-data'
import { CATEGORY_LABELS } from '@/lib/skills'
import { buildApplicationNote, getJobMatchReasons, getJobMeta } from '@/lib/matching'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplicationPreviewDialog } from '@/components/talent/ApplicationPreviewDialog'
import { JobCover } from '@/components/talent/JobCover'
import posthog from 'posthog-js'
import type { Job, Category, Profile, TalentSkill } from '@/types'

type JobResult = Job & { hirer?: { full_name: string } | null }
type SortOption = 'newest' | 'rate_high' | 'rate_low'
type WorkTypeFilter = 'all' | 'in_person' | 'remote' | 'hybrid'
type BudgetFilter = 'any' | 'under250' | '250to500' | 'over500'

const WORK_TYPE_OPTIONS: Record<WorkTypeFilter, string> = {
  all: 'All work types',
  in_person: 'In person',
  remote: 'Remote',
  hybrid: 'Hybrid',
}

const BUDGET_OPTIONS: Record<BudgetFilter, string> = {
  any: 'Any rate',
  under250: 'Under £250',
  '250to500': '£250 - £500',
  over500: 'Over £500',
}

const SORT_OPTIONS: Record<SortOption, string> = {
  newest: 'Newest first',
  rate_high: 'Rate: high to low',
  rate_low: 'Rate: low to high',
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="space-y-6 animate-pulse"><div className="h-8 w-48 rounded-lg bg-muted" /><div className="h-64 rounded-xl bg-muted" /></div>}>
      <DiscoverPageContent />
    </Suspense>
  )
}

function DiscoverPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<JobResult[]>([])
  const [talentProfile, setTalentProfile] = useState<(Profile & { talent_skills: TalentSkill[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [talentCategory, setTalentCategory] = useState<Category | null>(null)
  const [passed, setPassed] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'swipe' | 'grid' | 'list'>('grid')
  const search = searchParams.get('q') ?? ''
  const [sort, setSort] = useState<SortOption>('newest')
  const [workType, setWorkType] = useState<WorkTypeFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [budgetBand, setBudgetBand] = useState<BudgetFilter>('any')
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
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
        try {
          const existing = window.sessionStorage.getItem(DEMO_APPLICATIONS_STORAGE_KEY)
          const applications = existing ? JSON.parse(existing) as DemoApplication[] : []
          setApplied(new Set(applications.map(application => application.job_id)))
        } catch {
          // Ignore unreadable preview storage; applications simply start empty.
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
        .select('*, hirer:profiles!hirer_id(full_name)')
        .eq('status', 'open')
        .is('removed_at', null)
        .order('created_at', { ascending: false })

      if (primaryCategory) {
        query = query.eq('category', primaryCategory)
      }

      const [{ data: jobData }, { data: applicationData }] = await Promise.all([
        query,
        supabase.from('applications').select('job_id').eq('talent_id', user.id),
      ])
      setJobs((jobData ?? []) as JobResult[])
      setApplied(new Set((applicationData ?? []).map(application => application.job_id as string)))
      setLoading(false)
    }
    load()
  }, [router])

  const locations = useMemo(
    () => [...new Set(jobs.map(j => j.location))].sort((a, b) => a.localeCompare(b)),
    [jobs]
  )

  const locationOptions = useMemo<Record<string, string>>(
    () => ({ all: 'All locations', ...Object.fromEntries(locations.map(loc => [loc, loc])) }),
    [locations]
  )

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

    if (workType !== 'all') {
      filtered = filtered.filter(j => j.work_type === workType)
    }
    if (locationFilter !== 'all') {
      filtered = filtered.filter(j => j.location === locationFilter)
    }
    if (budgetBand !== 'any') {
      filtered = filtered.filter(j => {
        const rate = parseBudget(j.budget)
        if (budgetBand === 'under250') return rate > 0 && rate < 250
        if (budgetBand === '250to500') return rate >= 250 && rate <= 500
        return rate > 500
      })
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
  }, [jobs, passed, search, sort, workType, locationFilter, budgetBand])

  const hasActiveFilters = workType !== 'all' || locationFilter !== 'all' || budgetBand !== 'any'

  function clearFilters() {
    setWorkType('all')
    setLocationFilter('all')
    setBudgetBand('any')
  }

  function openJob(job: JobResult) {
    router.push(`/discover/${job.id}`)
  }

  function requestApplication(job: JobResult, shouldAdvance = false) {
    if (applied.has(job.id) || applyingId) return
    setDragX(0)
    setApplicationError(null)
    setAdvanceAfterApplication(shouldAdvance)
    setApplicationNote(buildApplicationNote(job, talentProfile))
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border">
              <Skeleton className="aspect-video rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-6 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageShell
        description={
          talentCategory
            ? `Matched for ${CATEGORY_LABELS[talentCategory]}`
            : 'Browse roles matched to your skills and availability.'
        }
        actions={
          visibleJobs.length > 0 ? (
            <div className="flex gap-0.5 rounded-lg bg-muted p-1">
              {(['grid', 'swipe', 'list'] as const).map(mode => (
                <Button
                  type="button"
                  key={mode}
                  size="xs"
                  variant={viewMode === mode ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={viewMode === mode ? 'bg-background text-foreground shadow-sm' : ''}
                >
                  {mode === 'swipe' ? <Layers className="size-3.5" /> : mode === 'grid' ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />}
                  <span>{mode}</span>
                </Button>
              ))}
            </div>
          ) : undefined
        }
      />
      {isLocalDemoMode() && (
        <p className="-mt-4 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Local demo mode</p>
      )}

      {/* Filters + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <Select items={WORK_TYPE_OPTIONS} value={workType} onValueChange={value => setWorkType((value ?? 'all') as WorkTypeFilter)}>
          <SelectTrigger aria-label="Filter by work type" className="w-auto min-w-[8.5rem] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WORK_TYPE_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={locationOptions} value={locationFilter} onValueChange={value => setLocationFilter(value ?? 'all')}>
          <SelectTrigger aria-label="Filter by location" className="w-auto min-w-[8.5rem] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(locationOptions).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={BUDGET_OPTIONS} value={budgetBand} onValueChange={value => setBudgetBand((value ?? 'any') as BudgetFilter)}>
          <SelectTrigger aria-label="Filter by rate" className="w-auto min-w-[7.5rem] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BUDGET_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="xs" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <div className="ml-auto">
          <Select items={SORT_OPTIONS} value={sort} onValueChange={value => setSort((value ?? 'newest') as SortOption)}>
            <SelectTrigger aria-label="Sort jobs" className="w-auto min-w-[7rem] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {visibleJobs.length} open {visibleJobs.length === 1 ? 'role' : 'roles'}
        {hasActiveFilters ? ' match your filters' : talentCategory ? ` in ${CATEGORY_LABELS[talentCategory]}` : ''}
        {search.trim() && <> · filtering by &ldquo;{search.trim()}&rdquo; - use the top search bar to change.</>}
      </p>

      {!hasJobsForView ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BriefcaseBusiness className="size-5" /></div>
          <p className="font-medium">
            {search.trim()
              ? 'No jobs match your search'
              : hasActiveFilters
                ? 'No jobs match your filters'
                : jobs.length === 0
                  ? 'No open jobs yet'
                  : "You've reviewed all jobs"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters ? 'Try widening or clearing your filters.' : 'Check back soon for new opportunities.'}
          </p>
          {hasActiveFilters && (
            <Button type="button" variant="outline" size="sm" className="mt-4 rounded-xl" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 card-stagger sm:grid-cols-2 lg:grid-cols-3">
          {visibleJobs.map(job => (
            <JobGridCard
              key={job.id}
              job={job}
              matchReasons={getJobMatchReasons(job, talentProfile)}
              applied={applied.has(job.id)}
              applying={applyingId === job.id}
              onApply={() => requestApplication(job)}
              onViewBrief={() => openJob(job)}
              onPass={() => passJob(job.id)}
            />
          ))}
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
              onViewBrief={() => openJob(job)}
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
                <JobCardContent job={next} matchReasons={getJobMatchReasons(next, talentProfile)} onViewBrief={() => openJob(next)} />
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
                <JobCardContent job={current} matchReasons={getJobMatchReasons(current, talentProfile)} onViewBrief={() => openJob(current)} />

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
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                onClick={() => passJob(current.id)}
                className="size-14 rounded-full bg-muted text-muted-foreground shadow-sm hover:text-foreground"
                aria-label="Pass on job"
              >
                <X className="size-5" />
              </Button>
              <Button
                type="button"
                size="icon-lg"
                onClick={() => requestApplication(current, true)}
                disabled={applyingId === current.id || applied.has(current.id)}
                className="size-14 rounded-full shadow-sm"
                aria-label="Apply to job"
              >
                {applyingId === current.id ? '...' : <Check className="size-5" />}
              </Button>
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
      <Button type="button" variant="link" size="xs" className="mt-4 h-auto self-start p-0" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onViewBrief() }}>
        View full brief →
      </Button>
    </div>
  )
}

function JobGridCard({
  job, matchReasons, applied, applying, onApply, onViewBrief, onPass,
}: {
  job: JobResult
  matchReasons: string[]
  applied: boolean
  applying: boolean
  onApply: () => void
  onViewBrief: () => void
  onPass: () => void
}) {
  const hirer = job.hirer as { full_name: string } | null
  const { workTypeLabel, deadlineLabel } = getJobMeta(job)
  return (
    <Card className="group/job flex h-full flex-col gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onViewBrief}
        aria-label={`View full brief for ${job.title}`}
        className="block w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <JobCover
          coverUrl={job.cover_url}
          category={job.category}
          title={job.title}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-video"
        >
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="bg-background/85 text-xs text-foreground shadow-sm backdrop-blur-sm">{CATEGORY_LABELS[job.category]}</Badge>
            {workTypeLabel && <Badge variant="secondary" className="bg-background/85 text-xs text-foreground shadow-sm backdrop-blur-sm">{workTypeLabel}</Badge>}
          </div>
        </JobCover>
      </button>
      <div className="flex flex-1 flex-col p-5">
      <h3 className="text-base font-semibold leading-tight">
        <button type="button" onClick={onViewBrief} className="text-left hover:underline focus-visible:underline focus-visible:outline-none">
          {job.title}
        </button>
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {hirer && <span>by {hirer.full_name}</span>}
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.5} />
          {job.location}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{job.description}</p>
      {matchReasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {matchReasons.slice(0, 2).map(reason => (
            <Badge key={reason} variant="secondary" className="text-[11px]">{reason}</Badge>
          ))}
        </div>
      )}
      <div className="mt-auto pt-4">
        <div className="flex items-baseline justify-between gap-2 border-t border-border pt-3">
          <p className="truncate text-sm font-semibold">{job.budget ?? <span className="font-normal text-muted-foreground">Rate on application</span>}</p>
          {deadlineLabel && <p className="shrink-0 text-[11px] text-muted-foreground">Apply by {deadlineLabel}</p>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPass} aria-label={`Pass on ${job.title}`}>
            Pass
          </Button>
          <Button variant="ghost" size="sm" className="px-3" onClick={onViewBrief} aria-label={`View full brief for ${job.title}`}>
            Brief
          </Button>
          <Button
            size="sm"
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
      </div>
      </div>
    </Card>
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
