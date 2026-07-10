'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { BriefcaseBusiness, Check, Grid2X2, List, MapPin, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/skills'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { Job, Category } from '@/types'

type JobResult = Job & { hirer?: { full_name: string } | null }
type SortOption = 'newest' | 'rate_high' | 'rate_low'

export default function DiscoverPage() {
  const [jobs, setJobs] = useState<JobResult[]>([])
  const [loading, setLoading] = useState(true)
  const [talentCategory, setTalentCategory] = useState<Category | null>(null)
  const [passed, setPassed] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('talent_skills(*)')
        .eq('id', user.id)
        .single()

      const skills = (profile as unknown as { talent_skills: { category: Category }[] })?.talent_skills ?? []
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
  }, [])

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

  async function applyToJob(jobId: string) {
    if (applied.has(jobId) || applyingId) return
    setApplyingId(jobId)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      })
      if (res.ok || res.status === 409) {
        setApplied(prev => new Set([...prev, jobId]))
      }
    } catch { /* silent */ }
    setApplyingId(null)
    advance()
  }

  function passJob(jobId: string) {
    setPassed(prev => new Set([...prev, jobId]))
    advance()
  }

  function advance() {
    setCurrentIndex(i => i + 1)
    setDragX(0)
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
    const currentJob = visibleJobs[currentIndex]
    if (!currentJob) { setDragX(0); return }
    if (elapsed > 0) {
      const velocity = Math.abs(dragX) / elapsed
      if (dragX > 80 || (dragX > 20 && velocity > 0.3)) { applyToJob(currentJob.id); return }
      if (dragX < -80 || (dragX < -20 && velocity > 0.3)) { passJob(currentJob.id); return }
    }
    setDragX(0)
  }

  const current = visibleJobs[currentIndex]
  const next = visibleJobs[currentIndex + 1]
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
          className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="newest">Newest</option>
          <option value="rate_high">Rate ↑</option>
          <option value="rate_low">Rate ↓</option>
        </select>
      </div>

      {visibleJobs.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BriefcaseBusiness className="size-5" /></div>
          <p className="font-medium">
            {jobs.length === 0 ? 'No open jobs yet' : "You've reviewed all jobs"}
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
              onApply={() => applyToJob(job.id)}
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
                <JobCardContent job={next} />
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
                <JobCardContent job={current} />

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
                {currentIndex + 1} / {visibleJobs.length}
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
                onClick={() => applyToJob(current.id)}
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
    </div>
  )
}

function JobCardContent({ job }: { job: JobResult }) {
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
    </div>
  )
}

function JobCard({
  job, applied, applying, onApply, onPass,
}: {
  job: JobResult
  applied: boolean
  applying: boolean
  onApply: () => void
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
