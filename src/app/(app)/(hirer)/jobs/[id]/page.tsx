'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { UsersRound } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/skills'
import { getJobMeta } from '@/lib/matching'
import {
  APPLICANT_TABS,
  APPLICATION_STATUS_LABELS,
  applicationMatchesTab,
  countApplicantsByTab,
  derivePipelineStage,
  type ApplicantTab,
} from '@/lib/job-pipeline'
import { PageShell } from '@/components/layout/PageShell'
import { useSetPageShell } from '@/components/layout/use-set-page-shell'
import { JobPipelineStepper } from '@/components/jobs/JobPipelineStepper'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Job, ApplicationStatus, Profile, TalentSkill } from '@/types'

type ApplicationRow = {
  id: string
  status: ApplicationStatus
  created_at: string
  profiles: (Profile & { talent_skills: TalentSkill[] }) | null
}

const LOADING_SHELL = { breadcrumbsLoading: true }

export default function JobDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [tab, setTab] = useState<ApplicantTab>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${id}`)
        if (cancelled) return
        if (!res.ok) {
          setLoadError('Unable to load this job')
          setLoading(false)
          return
        }
        const data = await res.json()
        if (cancelled) return
        setJob(data.job)
        setApplications(data.applications ?? [])
      } catch {
        if (!cancelled) setLoadError('Unable to load this job')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const toggleStatus = useCallback(async () => {
    if (!job) return
    const closing = job.status === 'open'
    if (closing && !window.confirm('Close this job? It will stop accepting new applications.')) return
    setToggling(true)
    const newStatus = closing ? 'closed' : 'open'
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const data = await res.json()
      setJob(data.job)
    }
    setToggling(false)
  }, [id, job])

  async function updateApplicationStatus(appId: string, status: ApplicationStatus) {
    setUpdatingId(appId)
    const res = await fetch(`/api/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a))
    }
    setUpdatingId(null)
  }

  const statuses = useMemo(() => applications.map(a => a.status), [applications])
  const stage = useMemo(() => derivePipelineStage(statuses), [statuses])
  const tabCounts = useMemo(() => countApplicantsByTab(statuses), [statuses])
  const visibleApplications = useMemo(
    () => applications.filter(a => applicationMatchesTab(a.status, tab)),
    [applications, tab]
  )

  const shellOverride = useMemo(() => {
    if (loadError) {
      return {
        breadcrumbs: [{ label: 'Jobs', href: '/jobs' }, { label: 'Job' }],
        title: 'Job',
      }
    }
    if (!job) return null
    const posted = new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const { workTypeLabel } = getJobMeta(job)
    return {
      breadcrumbs: [{ label: 'Jobs', href: '/jobs' }, { label: job.title }],
      eyebrow: CATEGORY_LABELS[job.category],
      title: job.title,
      description: [job.location, workTypeLabel, `Posted ${posted}`].filter(Boolean).join(' · '),
    }
  }, [job, loadError])

  useSetPageShell(loading ? LOADING_SHELL : shellOverride)

  if (loading) {
    return (
      <div className="py-4 animate-pulse">
        <div className="h-7 bg-muted rounded-xl w-3/4" />
        <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
          <div className="space-y-4 lg:col-start-2 lg:row-start-1">
            <Card className="h-48" />
          </div>
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            <Card className="h-32" />
            <Card className="h-24" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <PageShell />
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{loadError}</p>
      </div>
    )
  }

  if (!job) return null

  const jobMeta = getJobMeta(job)

  return (
    <div className="pb-8">
      <PageShell />

      <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        {/* Right rail: job overview + pipeline (first on mobile, sticky column on desktop) */}
        <aside className="space-y-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Budget</p>
                <p className="text-lg font-semibold">{job.budget ?? 'Not set'}</p>
              </div>
              <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className="text-xs capitalize">
                {job.status}
              </Badge>
            </div>

            <dl className="space-y-2 text-sm">
              {jobMeta.dateLabel && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Dates</dt>
                  <dd className="text-right">{jobMeta.dateLabel}</dd>
                </div>
              )}
              {jobMeta.deadlineLabel && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Apply by</dt>
                  <dd className="text-right">{jobMeta.deadlineLabel}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-xs">Location</dt>
                <dd className="text-right">{job.location}</dd>
              </div>
              {job.duration && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Duration</dt>
                  <dd className="text-right">{job.duration}</dd>
                </div>
              )}
              {job.travel_required != null && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Travel</dt>
                  <dd className="text-right">{job.travel_required ? 'Required' : 'Not expected'}</dd>
                </div>
              )}
              {job.usage_rights && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">Usage</dt>
                  <dd className="text-right">{job.usage_rights}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-xs">Applicants</dt>
                <dd className="text-right tabular-nums">{applications.length}</dd>
              </div>
            </dl>

            <Button
              variant={job.status === 'open' ? 'outline' : 'default'}
              className="w-full"
              onClick={toggleStatus}
              disabled={toggling}
            >
              {toggling ? '...' : job.status === 'open' ? 'Close job' : 'Reopen job'}
            </Button>

            {job.skills_required.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground text-xs mb-2">Skills required</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.skills_required.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="px-3 py-4">
            <JobPipelineStepper stage={stage} />
          </Card>

          <Link href="/search" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
            Search for talent
          </Link>
        </aside>

        {/* Main column: description + applicants */}
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <Card className="p-5 space-y-2">
            <h2 className="text-sm font-semibold">About this job</h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{job.description}</p>
          </Card>

          {/* Applicants */}
          <div>
            <h2 className="text-sm font-semibold mb-3">
              {applications.length} {applications.length === 1 ? 'Applicant' : 'Applicants'}
            </h2>

        {applications.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mb-2 flex justify-center text-muted-foreground"><UsersRound className="size-6" /></div>
            <p className="text-muted-foreground text-sm">No applicants yet.</p>
            <Link href="/search" className="text-primary text-xs mt-2 inline-block hover:text-primary/80">
              Search for talent to reach out
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            <Tabs value={tab} onValueChange={value => setTab(value as ApplicantTab)}>
              <TabsList className="w-full max-w-full justify-start overflow-x-auto">
                {APPLICANT_TABS.map(t => (
                  <TabsTrigger key={t.tab} value={t.tab} className="flex-1">
                    {t.label}
                    <span className="text-muted-foreground text-[11px] tabular-nums">{tabCounts[t.tab]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {visibleApplications.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground text-sm">No applicants in this stage yet.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {visibleApplications.map(app => {
                  const talent = app.profiles
                  if (!talent) return null
                  const updating = updatingId === app.id
                  return (
                    <Card key={app.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`/talent/${talent.id}`}>
                          <Avatar className="h-11 w-11 rounded-xl">
                            <AvatarImage src={talent.avatar_url ?? ''} alt={talent.full_name} />
                            <AvatarFallback className="rounded-xl text-xl font-bold">
                              {talent.full_name[0]}
                            </AvatarFallback>
                          </Avatar>
                        </Link>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/talent/${talent.id}`} className="font-medium text-sm hover:text-primary transition-colors truncate">
                              {talent.full_name}
                            </Link>
                            <Badge
                              variant={app.status === 'hired' ? 'default' : 'secondary'}
                              className="text-[10px] shrink-0"
                            >
                              {APPLICATION_STATUS_LABELS[app.status]}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs truncate mt-0.5">
                            {talent.talent_skills.slice(0, 2).map(s => s.skill).join(' · ')}
                          </p>
                        </div>

                        {app.status !== 'hired' && app.status !== 'declined' && (
                          <div className="flex shrink-0 items-center gap-2">
                            {app.status !== 'shortlisted' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updating}
                                onClick={() => updateApplicationStatus(app.id, 'shortlisted')}
                              >
                                Shortlist
                              </Button>
                            )}
                            <Button
                              size="sm"
                              disabled={updating}
                              onClick={() => updateApplicationStatus(app.id, 'hired')}
                            >
                              Hire
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              disabled={updating}
                              onClick={() => {
                                if (window.confirm(`Decline ${talent.full_name}? They will see that this role went in a different direction.`)) {
                                  updateApplicationStatus(app.id, 'declined')
                                }
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
