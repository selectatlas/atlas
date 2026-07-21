'use client'

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bell, BellPlus, BriefcaseBusiness, Check, Layers, LayoutGrid, List, MapPin, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isLocalDemoMode } from '@/lib/demo-mode'
import { DEMO_APPLICATIONS_STORAGE_KEY, DEMO_JOBS, DEMO_PROFILE, type DemoApplication } from '@/lib/demo-data'
import { CATEGORY_LABELS } from '@/lib/skills'
import { BUDGET_BANDS, JOB_SORTS, WORK_TYPE_FILTERS, parseBudgetRange, type BudgetBand, type JobSort, type WorkTypeFilter } from '@/lib/job-discovery'
import { buildApplicationNote, getJobMatchReasons, getJobMeta } from '@/lib/matching'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplicationPreviewDialog } from '@/components/talent/ApplicationPreviewDialog'
import { JobCover } from '@/components/talent/JobCover'
import { JobFilterSheet, type JobFilterValues } from '@/components/talent/JobFilterSheet'
import type { JobAlert } from '@/lib/job-alerts'
import posthog from 'posthog-js'
import type { Job, Category, Profile, TalentSkill } from '@/types'

type JobResult = Job & { hirer?: { full_name: string } | null; match_score?: number | null }
type JobFeedPage = { jobs: JobResult[]; nextCursor: string | null; total: number | null }

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

const WORK_TYPE_OPTIONS: Record<WorkTypeFilter, string> = {
  all: 'All work types',
  in_person: 'In person',
  remote: 'Remote',
  hybrid: 'Hybrid',
}

const BUDGET_OPTIONS: Record<BudgetBand, string> = {
  any: 'Any rate',
  under250: 'Under £250',
  '250to500': '£250 - £500',
  over500: 'Over £500',
}

const SORT_OPTIONS: Record<JobSort, string> = {
  relevance: 'Best match',
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
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [locations, setLocations] = useState<string[]>([])
  const [talentProfile, setTalentProfile] = useState<(Profile & { talent_skills: TalentSkill[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [talentCategories, setTalentCategories] = useState<Category[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [baselineCount, setBaselineCount] = useState<number | null>(null)
  const [forYouJobs, setForYouJobs] = useState<JobResult[] | null>(null)
  const [alerts, setAlerts] = useState<JobAlert[]>([])
  const [savingAlert, setSavingAlert] = useState(false)
  const [passed, setPassed] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'swipe' | 'grid' | 'list'>('grid')
  // Filters and sort live in the URL so results are shareable, survive
  // reloads, and drive the server-side feed query.
  const search = searchParams.get('q') ?? ''
  // Searching defaults to semantic "best match" ranking; browsing to newest.
  const defaultSort: JobSort = search.trim() ? 'relevance' : 'newest'
  const sort = normalizeChoice(searchParams.get('sort'), JOB_SORTS, defaultSort)
  const workType = normalizeChoice(searchParams.get('work'), WORK_TYPE_FILTERS, 'all')
  const budgetBand = normalizeChoice(searchParams.get('rate'), BUDGET_BANDS, 'any')
  const locationFilter = searchParams.get('loc') ?? 'all'
  // Category chip selection: unset = the talent's own categories ("For you"),
  // 'all' = the whole market, or one specific category.
  const catParam = searchParams.get('cat')
  const selectedCat: 'mine' | 'all' | Category =
    catParam === 'all' ? 'all' : ALL_CATEGORIES.includes(catParam as Category) ? (catParam as Category) : 'mine'
  const requestIdRef = useRef(0)
  const reducedMotion = useReducedMotion()
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
        setTalentCategories(['dancer'])
        setJobs(DEMO_JOBS)
        try {
          const existing = window.sessionStorage.getItem(DEMO_APPLICATIONS_STORAGE_KEY)
          const applications = existing ? JSON.parse(existing) as DemoApplication[] : []
          setApplied(new Set(applications.map(application => application.job_id)))
        } catch {
          // Ignore unreadable preview storage; applications simply start empty.
        }
        setLoading(false)
        setLoadingJobs(false)
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        router.push('/login')
        return
      }

      const [{ data: profile }, { data: applicationData }, { data: locationData }, { data: countData }] = await Promise.all([
        supabase.from('profiles').select(PUBLIC_PROFILE_WITH_SKILLS).eq('id', user.id).single(),
        supabase.from('applications').select('job_id').eq('talent_id', user.id),
        supabase.rpc('open_job_locations'),
        supabase.rpc('open_job_category_counts'),
      ])

      const talent = profile as unknown as Profile & { talent_skills: TalentSkill[] }
      setTalentProfile(talent)
      const skills = talent.talent_skills ?? []
      // Every category the talent has a skill in - not just the first - so
      // multi-discipline talent see their whole market.
      setTalentCategories(Array.from(new Set(skills.map(skill => skill.category))))
      setApplied(new Set((applicationData ?? []).map(application => application.job_id as string)))
      setLocations(((locationData ?? []) as string[]).filter(Boolean))
      const counts: Record<string, number> = {}
      for (const row of (countData ?? []) as { category: string; job_count: number | string }[]) {
        counts[row.category] = Number(row.job_count)
      }
      setCategoryCounts(counts)
      setLoading(false)

      // Ranked stack + saved alerts load after the page is interactive;
      // neither blocks the first paint and failures degrade silently.
      void fetch('/api/jobs/for-you')
        .then(res => (res.ok ? (res.json() as Promise<{ jobs: JobResult[] }>) : null))
        .then(data => { if (data) setForYouJobs(data.jobs) })
        .catch(() => {})
      void fetch('/api/jobs/alerts')
        .then(res => (res.ok ? (res.json() as Promise<{ alerts: JobAlert[] }>) : null))
        .then(data => { if (data) setAlerts(data.alerts) })
        .catch(() => {})
    }
    load()
  }, [router])

  const effectiveCategories = useMemo<Category[]>(() => {
    if (selectedCat === 'all') return []
    if (selectedCat === 'mine') return talentCategories
    return [selectedCat]
  }, [selectedCat, talentCategories])

  // Server-driven feed: refetch page one whenever the filters change. The
  // request id guards against a slow response overwriting a newer one.
  useEffect(() => {
    if (loading || isLocalDemoMode()) return
    const requestId = ++requestIdRef.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the feed when filters change
    setLoadingJobs(true)
    setJobs([])
    setNextCursor(null)
    const params = buildFeedQuery({ categories: effectiveCategories, search, workType, location: locationFilter, budgetBand, sort, cursor: null })
    fetch(`/api/jobs?${params}`)
      .then(res => (res.ok ? (res.json() as Promise<JobFeedPage>) : Promise.reject(new Error(`${res.status}`))))
      .then(page => {
        if (requestIdRef.current !== requestId) return
        setJobs(page.jobs)
        setNextCursor(page.nextCursor)
        setTotal(page.total)
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return
        setJobs([])
        setTotal(0)
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoadingJobs(false)
      })
  }, [loading, effectiveCategories, search, sort, workType, locationFilter, budgetBand])

  async function loadMore() {
    if (!nextCursor || loadingMore || loadingJobs || isLocalDemoMode()) return
    setLoadingMore(true)
    const requestId = requestIdRef.current
    try {
      const params = buildFeedQuery({ categories: effectiveCategories, search, workType, location: locationFilter, budgetBand, sort, cursor: nextCursor })
      const res = await fetch(`/api/jobs?${params}`)
      if (!res.ok || requestIdRef.current !== requestId) return
      const page = await res.json() as JobFeedPage
      if (requestIdRef.current !== requestId) return
      setJobs(prev => {
        const seen = new Set(prev.map(job => job.id))
        return [...prev, ...page.jobs.filter(job => !seen.has(job.id))]
      })
      setNextCursor(page.nextCursor)
    } catch {
      // Keep the current deck; the button stays visible so the user can retry.
    } finally {
      setLoadingMore(false)
    }
  }

  const derivedLocations = useMemo(
    () => [...new Set(jobs.map(j => j.location))].sort((a, b) => a.localeCompare(b)),
    [jobs]
  )

  const locationOptions = useMemo<Record<string, string>>(() => {
    const source = locations.length > 0 ? locations : derivedLocations
    const withSelected = locationFilter !== 'all' && !source.includes(locationFilter)
      ? [...source, locationFilter].sort((a, b) => a.localeCompare(b))
      : source
    return { all: 'All locations', ...Object.fromEntries(withSelected.map(loc => [loc, loc])) }
  }, [locations, derivedLocations, locationFilter])

  const visibleJobs = useMemo(() => {
    const remaining = jobs.filter(j => !passed.has(j.id))
    // Real mode: the server already filtered and sorted; only locally
    // passed jobs need hiding. The pipeline below serves local demo mode,
    // which has no API and works over the small in-memory demo set.
    if (!isLocalDemoMode()) return remaining

    let filtered = remaining

    if (effectiveCategories.length > 0) {
      filtered = filtered.filter(j => effectiveCategories.includes(j.category))
    }

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
        const { min, max } = parseBudgetRange(j.budget)
        if (min === null || max === null) return false
        if (budgetBand === 'under250') return min < 250
        if (budgetBand === '250to500') return max >= 250 && min <= 500
        return max > 500
      })
    }

    filtered = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'rate_high':
          return (parseBudgetRange(b.budget).max ?? 0) - (parseBudgetRange(a.budget).max ?? 0)
        case 'rate_low':
          return (parseBudgetRange(a.budget).min ?? 0) - (parseBudgetRange(b.budget).min ?? 0)
        default:
          // 'newest', and 'relevance' (demo mode has no embeddings to rank on)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return filtered
  }, [jobs, passed, search, sort, workType, locationFilter, budgetBand, effectiveCategories])

  const hasActiveFilters = workType !== 'all' || locationFilter !== 'all' || budgetBand !== 'any'
  const activeFilterCount = [workType !== 'all', locationFilter !== 'all', budgetBand !== 'any'].filter(Boolean).length
  const categoryTotal = useMemo(() => {
    const values = Object.values(categoryCounts)
    return values.length > 0 ? values.reduce((sum, count) => sum + count, 0) : null
  }, [categoryCounts])
  // Talent with no skills yet has no "For you" scope; the All chip is their reality.
  const displayCat = selectedCat === 'mine' && talentCategories.length === 0 ? 'all' : selectedCat
  // "Best match" is semantic ranking of a search; without a search term it
  // has nothing to rank, so hide it from the sort menu.
  const sortOptions = useMemo<Record<string, string>>(
    () => (search.trim()
      ? SORT_OPTIONS
      : Object.fromEntries(Object.entries(SORT_OPTIONS).filter(([key]) => key !== 'relevance'))),
    [search],
  )

  function applyFilterParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    update(params)
    const query = params.toString()
    router.replace(query ? `/discover?${query}` : '/discover', { scroll: false })
  }

  function setFilterParam(key: 'work' | 'loc' | 'rate' | 'sort' | 'cat', value: string, defaultValue: string) {
    applyFilterParams(params => {
      if (value === defaultValue) params.delete(key)
      else params.set(key, value)
    })
  }

  function clearFilters() {
    applyFilterParams(params => {
      params.delete('work')
      params.delete('loc')
      params.delete('rate')
    })
  }

  function applySheetFilters(values: JobFilterValues) {
    applyFilterParams(params => {
      if (values.workType === 'all') params.delete('work'); else params.set('work', values.workType)
      if (values.location === 'all') params.delete('loc'); else params.set('loc', values.location)
      if (values.budgetBand === 'any') params.delete('rate'); else params.set('rate', values.budgetBand)
      if (values.sort === defaultSort) params.delete('sort'); else params.set('sort', values.sort)
    })
  }

  // Live "Show N roles" count for the filter sheet's apply button.
  const fetchFilterCount = useCallback(async (draft: JobFilterValues): Promise<number | null> => {
    if (isLocalDemoMode()) return null
    const params = buildFeedQuery({
      categories: effectiveCategories,
      search,
      workType: draft.workType,
      location: draft.location,
      budgetBand: draft.budgetBand,
      sort: draft.sort,
      cursor: null,
    })
    params.set('count', '1')
    try {
      const res = await fetch(`/api/jobs?${params}`)
      if (!res.ok) return null
      const page = await res.json() as JobFeedPage
      return page.total
    } catch {
      return null
    }
  }, [effectiveCategories, search])

  // When filters zero out the feed, fetch how many roles exist without them
  // so the empty state can say what clearing would recover.
  useEffect(() => {
    if (loading || isLocalDemoMode() || total !== 0 || !hasActiveFilters) return
    let cancelled = false
    const params = buildFeedQuery({
      categories: effectiveCategories, search, workType: 'all', location: 'all', budgetBand: 'any', sort: 'newest', cursor: null,
    })
    params.set('count', '1')
    fetch(`/api/jobs?${params}`)
      .then(res => (res.ok ? (res.json() as Promise<JobFeedPage>) : null))
      .then(page => {
        if (!cancelled && page) setBaselineCount(page.total)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [loading, total, hasActiveFilters, effectiveCategories, search])

  // Save the current search + filters as a job alert (API-shaped params, so
  // the stored filters double as the alert's count query).
  async function saveCurrentSearch() {
    if (savingAlert || isLocalDemoMode()) return
    setSavingAlert(true)
    try {
      const filters: Record<string, string> = {}
      if (effectiveCategories.length > 0) filters.category = effectiveCategories.join(',')
      if (workType !== 'all') filters.work = workType
      if (locationFilter !== 'all') filters.loc = locationFilter
      if (budgetBand !== 'any') filters.rate = budgetBand
      const name = (
        search.trim() ||
        [
          workType !== 'all' ? WORK_TYPE_OPTIONS[workType] : null,
          locationFilter !== 'all' ? locationFilter : null,
          budgetBand !== 'any' ? BUDGET_OPTIONS[budgetBand] : null,
        ].filter(Boolean).join(' · ') ||
        'All roles'
      ).slice(0, 80)
      const res = await fetch('/api/jobs/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, query: search.trim(), filters }),
      })
      if (res.ok) {
        const data = await res.json() as { alert: JobAlert }
        setAlerts(prev => [data.alert, ...prev])
      }
    } catch {
      // Silent: the button re-enables and the user can retry.
    } finally {
      setSavingAlert(false)
    }
  }

  function applyAlert(alert: JobAlert) {
    const params = new URLSearchParams()
    if (alert.query) params.set('q', alert.query)
    if (alert.filters.work) params.set('work', alert.filters.work)
    if (alert.filters.loc) params.set('loc', alert.filters.loc)
    if (alert.filters.rate) params.set('rate', alert.filters.rate)
    // The page URL holds one chip: a single stored category maps onto it; a
    // multi-category alert that isn't just "my categories" widens to All.
    const categories = (alert.filters.category ?? '').split(',').filter(Boolean)
    if (categories.length === 1) params.set('cat', categories[0])
    else if (categories.length > 1 && categories.join(',') !== talentCategories.join(',')) params.set('cat', 'all')
    const query = params.toString()
    router.replace(query ? `/discover?${query}` : '/discover', { scroll: false })
    setAlerts(prev => prev.map(item => (item.id === alert.id ? { ...item, new_count: 0 } : item)))
    void fetch(`/api/jobs/alerts/${alert.id}`, { method: 'PATCH' }).catch(() => {})
  }

  function deleteAlert(id: string) {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
    void fetch(`/api/jobs/alerts/${id}`, { method: 'DELETE' }).catch(() => {})
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
    maybeTopUpDeck()
  }

  function passJob(jobId: string) {
    setPassed(prev => new Set([...prev, jobId]))
    setDragX(0)
    posthog.capture('job_passed', { job_id: jobId })
    if (!isLocalDemoMode()) {
      // Fire-and-forget: the pass is already applied optimistically, and a
      // lost write only means the job reappears next session.
      void fetch('/api/jobs/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      }).catch(() => {})
    }
    maybeTopUpDeck()
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

  // The swipe deck is the ranked "Today's matches" stack when one exists and
  // the talent is not mid-search/filter; otherwise it falls back to the
  // regular feed. The stack is deliberately finite - finishing it is the
  // point - so it never pages.
  const forYouEligible =
    !isLocalDemoMode() && (forYouJobs?.length ?? 0) > 0 && !hasActiveFilters && !search.trim() && selectedCat === 'mine'
  const forYouActive = viewMode === 'swipe' && forYouEligible
  const swipeJobs = (forYouActive && forYouJobs ? forYouJobs.filter(job => !passed.has(job.id)) : visibleJobs)
    .filter(job => !applied.has(job.id))
  const current = swipeJobs[0]
  const next = swipeJobs[1]
  // Count only jobs in the active deck: `applied` holds ALL of the talent's
  // applications (including closed/other-category jobs), so sizing the sets
  // directly would overshoot the "N / N" progress counter.
  const stackSource = forYouActive && forYouJobs ? forYouJobs : jobs
  const reviewedCount = stackSource.reduce(
    (count, job) => count + (passed.has(job.id) || applied.has(job.id) ? 1 : 0),
    0,
  )
  const deckSize = forYouActive && forYouJobs ? forYouJobs.length : total ?? jobs.length
  const progressPosition = Math.min(reviewedCount + 1, Math.max(deckSize, 1))
  const hasJobsForView = viewMode === 'swipe' ? swipeJobs.length > 0 : visibleJobs.length > 0
  const roleCount = total ?? visibleJobs.length
  const rotation = dragging && !reducedMotion ? dragX * 0.06 : 0
  const isRight = dragX > 40
  const isLeft = dragX < -40

  // Keep the swipe deck topped up: called from pass/apply/view-switch events
  // so the next page arrives before the deck runs dry. The For You stack is
  // finite by design and never tops up.
  function maybeTopUpDeck(nextMode: 'swipe' | 'grid' | 'list' = viewMode) {
    if (nextMode !== 'swipe' || forYouEligible) return
    if (swipeJobs.length < 6 && nextCursor) void loadMore()
  }

  if (loading || (loadingJobs && jobs.length === 0)) {
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
          talentCategories.length > 0
            ? `Matched for ${talentCategories.map(category => CATEGORY_LABELS[category]).join(' · ')}`
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
                  onClick={() => { setViewMode(mode); maybeTopUpDeck(mode) }}
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

      {/* Category chips: the talent's own market first, then the rest */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {talentCategories.length > 0 && (
          <CategoryChip active={displayCat === 'mine'} onClick={() => setFilterParam('cat', 'mine', 'mine')}>
            For you
          </CategoryChip>
        )}
        <CategoryChip active={displayCat === 'all'} onClick={() => setFilterParam('cat', 'all', 'mine')}>
          All categories{categoryTotal !== null ? ` · ${categoryTotal}` : ''}
        </CategoryChip>
        {ALL_CATEGORIES.map(category => (
          <CategoryChip
            key={category}
            active={displayCat === category}
            onClick={() => setFilterParam('cat', category, 'mine')}
          >
            {CATEGORY_LABELS[category]}{categoryCounts[category] !== undefined ? ` · ${categoryCounts[category]}` : ''}
          </CategoryChip>
        ))}
      </div>

      {/* Saved job alerts: applying one loads its search and clears its count */}
      {alerts.length > 0 && (
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <Bell className="size-3.5" /> Alerts
          </span>
          {alerts.map(alert => (
            <Badge key={alert.id} variant="secondary" className="shrink-0 gap-1 rounded-full pr-1 text-xs">
              <button type="button" onClick={() => applyAlert(alert)} className="flex items-center gap-1.5 hover:underline">
                {alert.name}
                {(alert.new_count ?? 0) > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                    {alert.new_count} new
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => deleteAlert(alert.id)}
                aria-label={`Delete alert ${alert.name}`}
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Mobile: filter sheet trigger + applied-filter chips */}
      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setFilterSheetOpen(true)}>
          <SlidersHorizontal className="size-3.5" />
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
        </Button>
        {(hasActiveFilters || search.trim()) && !isLocalDemoMode() && alerts.length < 10 && (
          <Button type="button" variant="ghost" size="sm" onClick={saveCurrentSearch} disabled={savingAlert}>
            <BellPlus className="size-3.5" />
            {savingAlert ? 'Saving...' : 'Save alert'}
          </Button>
        )}
        {workType !== 'all' && (
          <FilterChip label={WORK_TYPE_OPTIONS[workType]} onRemove={() => setFilterParam('work', 'all', 'all')} />
        )}
        {locationFilter !== 'all' && (
          <FilterChip label={locationFilter} onRemove={() => setFilterParam('loc', 'all', 'all')} />
        )}
        {budgetBand !== 'any' && (
          <FilterChip label={BUDGET_OPTIONS[budgetBand]} onRemove={() => setFilterParam('rate', 'any', 'any')} />
        )}
      </div>

      {/* Desktop: inline filters + sort */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <Select items={WORK_TYPE_OPTIONS} value={workType} onValueChange={value => setFilterParam('work', value ?? 'all', 'all')}>
          <SelectTrigger aria-label="Filter by work type" className="w-auto min-w-[8.5rem] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WORK_TYPE_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={locationOptions} value={locationFilter} onValueChange={value => setFilterParam('loc', value ?? 'all', 'all')}>
          <SelectTrigger aria-label="Filter by location" className="w-auto min-w-[8.5rem] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(locationOptions).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={BUDGET_OPTIONS} value={budgetBand} onValueChange={value => setFilterParam('rate', value ?? 'any', 'any')}>
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
        {(hasActiveFilters || search.trim()) && !isLocalDemoMode() && alerts.length < 10 && (
          <Button type="button" variant="ghost" size="xs" onClick={saveCurrentSearch} disabled={savingAlert}>
            <BellPlus className="size-3.5" />
            {savingAlert ? 'Saving...' : 'Save alert'}
          </Button>
        )}
        <div className="ml-auto">
          <Select items={sortOptions} value={sort} onValueChange={value => setFilterParam('sort', value ?? defaultSort, defaultSort)}>
            <SelectTrigger aria-label="Sort jobs" className="w-auto min-w-[7rem] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sortOptions).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {roleCount} open {roleCount === 1 ? 'role' : 'roles'}
        {hasActiveFilters
          ? ' match your filters'
          : displayCat === 'all'
            ? ' across all categories'
            : displayCat === 'mine'
              ? (talentCategories.length > 0 ? ` in ${talentCategories.map(category => CATEGORY_LABELS[category]).join(' · ')}` : '')
              : ` in ${CATEGORY_LABELS[displayCat]}`}
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
            {hasActiveFilters
              ? baselineCount !== null && baselineCount > 0
                ? `${baselineCount} open ${baselineCount === 1 ? 'role matches' : 'roles match'} without your filters.`
                : 'Try widening or clearing your filters.'
              : 'Check back soon for new opportunities.'}
          </p>
          {hasActiveFilters && (
            <Button type="button" variant="outline" size="sm" className="mt-4 rounded-xl" onClick={clearFilters}>
              {baselineCount !== null && baselineCount > 0
                ? `Clear filters · see ${baselineCount} ${baselineCount === 1 ? 'role' : 'roles'}`
                : 'Clear filters'}
            </Button>
          )}
          {!hasActiveFilters && nextCursor && (
            <Button type="button" variant="outline" size="sm" className="mt-4 rounded-xl" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more roles'}
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <>
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
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more roles'}
              </Button>
            </div>
          )}
        </>
      ) : viewMode === 'list' ? (
        <>
          <div className="flex flex-col gap-4 card-stagger">
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
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more roles'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="pb-20">
          {forYouActive && (
            <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4 text-primary" />
              Today&rsquo;s matches · ranked for you
            </p>
          )}
          <div className="relative select-none h-[460px]">
            {next && (
              <div
                className="absolute inset-0 bg-card border rounded-3xl overflow-hidden"
                style={{ transform: 'scale(0.95)', transformOrigin: 'bottom center', zIndex: 1 }}
              >
                <JobCardContent job={next} matchScore={next.match_score ?? null} matchReasons={getJobMatchReasons(next, talentProfile)} onViewBrief={() => openJob(next)} />
              </div>
            )}

            {current && (
              <div
                ref={cardRef}
                className="absolute inset-0 bg-card border rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing shadow-2xl"
                style={{
                  transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
                  transition: dragging || reducedMotion ? 'none' : 'transform var(--duration-base) var(--ease-out)',
                  zIndex: 2,
                  touchAction: 'none',
                }}
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              >
                <JobCardContent job={current} matchScore={current.match_score ?? null} matchReasons={getJobMatchReasons(current, talentProfile)} onViewBrief={() => openJob(current)} />

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
                {progressPosition} / {Math.max(deckSize, 1)}
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

      <JobFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        initial={{ workType, location: locationFilter, budgetBand, sort }}
        workTypeOptions={WORK_TYPE_OPTIONS}
        locationOptions={locationOptions}
        budgetOptions={BUDGET_OPTIONS}
        sortOptions={sortOptions}
        fetchCount={fetchFilterCount}
        onApply={applySheetFilters}
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

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      size="xs"
      variant={active ? 'secondary' : 'outline'}
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full ${active ? 'bg-foreground text-background hover:bg-foreground/90' : ''}`}
    >
      {children}
    </Button>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 rounded-full pr-1 text-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="rounded-full p-0.5 hover:bg-foreground/10"
      >
        <X className="size-3" />
      </button>
    </Badge>
  )
}

function JobCardContent({ job, matchScore, matchReasons, onViewBrief }: { job: JobResult; matchScore?: number | null; matchReasons: string[]; onViewBrief: () => void }) {
  const hirer = job.hirer as { full_name: string } | null
  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-3 flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs">
          {CATEGORY_LABELS[job.category]}
        </Badge>
        {typeof matchScore === 'number' && (
          <Badge className="gap-1 text-xs">
            <Sparkles className="size-3" />
            {matchScore}% match
          </Badge>
        )}
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
            {typeof job.match_score === 'number' && (
              <Badge className="gap-1 text-xs shadow-sm">
                <Sparkles className="size-3" />
                {job.match_score}% match
              </Badge>
            )}
          </div>
        </JobCover>
      </button>
      <div className="flex flex-1 flex-col p-5">
      <h3 className="text-base font-semibold leading-tight">
        <button type="button" onClick={onViewBrief} className="text-left hover:underline focus-visible:underline focus-visible:outline-none active:opacity-60">
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

function normalizeChoice<T extends string>(value: string | null, choices: readonly T[], fallback: T): T {
  return value !== null && (choices as readonly string[]).includes(value) ? (value as T) : fallback
}

function buildFeedQuery(options: {
  categories: Category[]
  search: string
  workType: WorkTypeFilter
  location: string
  budgetBand: BudgetBand
  sort: JobSort
  cursor: string | null
}): URLSearchParams {
  const params = new URLSearchParams()
  if (options.categories.length > 0) params.set('category', options.categories.join(','))
  if (options.search.trim()) params.set('q', options.search.trim())
  if (options.workType !== 'all') params.set('work', options.workType)
  if (options.location !== 'all') params.set('loc', options.location)
  if (options.budgetBand !== 'any') params.set('rate', options.budgetBand)
  if (options.sort !== 'newest') params.set('sort', options.sort)
  if (options.cursor) params.set('cursor', options.cursor)
  return params
}
