import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock3, MapPin, Plane, ShieldCheck, UserRound } from 'lucide-react'
import { createAnonClient } from '@/lib/supabase/server'
import { CATEGORY_LABELS } from '@/lib/skills'
import { formatDate, getJobMeta } from '@/lib/matching'
import { isUuid } from '@/lib/validation'
import { PUBLIC_JOB_COLUMNS } from '@/lib/job-discovery'
import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/job-posting-jsonld'
import { resolveCoverUrl } from '@/lib/job-cover'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { JobCover } from '@/components/talent/JobCover'
import { AuthAwareApplyCta } from '@/components/jobs/AuthAwareApplyCta'
import { JobMetaItem } from '@/components/jobs/JobMetaItem'
import type { Job } from '@/types'

// ISR detail page: rendered on demand, revalidated every 5 minutes. Closed,
// removed, and unknown jobs are invisible through public_open_jobs, so they
// all resolve to notFound() automatically.
export const revalidate = 300
// force-static is load-bearing, not an optimisation: the Supabase fetch
// defaults to no-store, which silently made this route dynamic. Dynamic
// routes stream their metadata for browser user agents, so notFound()
// could no longer set a real 404 status - closed and removed jobs
// answered 200 with a not-found body. Static rendering restores the ISR
// design above AND blocking metadata, making the 404 genuine.
export const dynamic = 'force-static'

export async function generateStaticParams() {
  // Build nothing up front; every job renders on first request and is cached.
  return []
}

type PublicJob = Job & { hirer_name: string | null; hirer_avatar_url: string | null }

// cache() dedupes the fetch between generateMetadata and the page render.
const fetchPublicJob = cache(async (id: string): Promise<PublicJob | null> => {
  if (!isUuid(id)) return null
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('public_open_jobs')
    .select(PUBLIC_JOB_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  // A transient failure must not be mistaken for "job does not exist" - a
  // thrown error keeps ISR serving the last good page instead of caching a
  // 404 for a live job.
  if (error) throw new Error('Job lookup failed')
  return (data as unknown as PublicJob | null) ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const job = await fetchPublicJob(id)
  // Next 16 cannot put a 404 status on an on-demand ISR render (the
  // not-found boundary is served and cached with 200 - vercel/next.js
  // #76474, still open at 16.2.10; verified empirically against this
  // route). noindex is the enforceable crawler contract instead: missing,
  // closed, and removed jobs must never be indexed as live pages.
  if (!job) return { title: 'Job not found', robots: { index: false } }

  const description = job.description.replace(/\s+/g, ' ').trim().slice(0, 155)
  const cover = resolveCoverUrl(job.cover_url)
  return {
    title: `${job.title} - ${job.location}`,
    description,
    alternates: { canonical: `/jobs/${job.id}` },
    openGraph: {
      title: `${job.title} - ${job.location} | Atlas`,
      description,
      url: `/jobs/${job.id}`,
      ...(cover ? { images: [cover] } : {}),
    },
  }
}

export default async function PublicJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await fetchPublicJob(id)
  if (!job) notFound()

  const meta = getJobMeta(job)
  const postedDate = formatDate(job.created_at)

  return (
    <div className="space-y-6 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJobPostingJsonLd(job)) }}
      />
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All jobs
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
        </div>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{job.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-4" strokeWidth={1.5} />
            {job.hirer_name ?? 'Creative team'}
          </span>
          {postedDate && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" strokeWidth={1.5} />
              Posted {postedDate}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        {/* Sticky action card: first on mobile, right column on desktop */}
        <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rate</p>
                <p className="text-lg font-semibold">{job.budget ?? 'Rate on application'}</p>
              </div>
              <Badge>Open</Badge>
            </div>

            <div className="space-y-2">
              {meta.dateLabel && <JobMetaItem icon={CalendarDays} label="Dates" value={meta.dateLabel} />}
              {meta.deadlineLabel && <JobMetaItem icon={CalendarDays} label="Apply by" value={meta.deadlineLabel} />}
              <JobMetaItem icon={MapPin} label="Location" value={job.location} />
              {job.duration && <JobMetaItem icon={Clock3} label="Duration" value={job.duration} />}
              {job.travel_required !== null && job.travel_required !== undefined && (
                <JobMetaItem
                  icon={Plane}
                  label="Travel"
                  value={job.travel_required ? 'Travel may be required' : 'No travel expected'}
                />
              )}
              {job.usage_rights && <JobMetaItem icon={ShieldCheck} label="Usage" value={job.usage_rights} />}
            </div>

            <AuthAwareApplyCta jobId={job.id} />
          </Card>
        </aside>

        {/* Main column: narrative content */}
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          <section>
            <h2 className="text-sm font-semibold">The brief</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{job.description}</p>
          </section>

          {job.skills_required.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold">What they are looking for</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.skills_required.map(skill => (
                  <Badge key={skill} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
