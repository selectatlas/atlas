import type { Metadata } from 'next'
import { createAnonClient } from '@/lib/supabase/server'
import { fetchDiscoverJobs } from '@/lib/job-discovery'
import { PublicJobsExplorer } from '@/components/jobs/PublicJobsExplorer'
import type { Category } from '@/types'

// ISR: rendered without cookies or searchParams so the page stays static,
// revalidating every 5 minutes. Crawlers get the newest open jobs as real
// HTML; the explorer island handles filters and pagination client-side.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Browse creative jobs - dancers, actors, creators',
  description:
    'Open casting calls and creative jobs for dancers, actors, and content creators. Browse briefs, rates, and locations - sign up to apply in minutes.',
  alternates: { canonical: '/jobs' },
  openGraph: {
    title: 'Browse creative jobs on Atlas',
    description:
      'Open casting calls and creative jobs for dancers, actors, and content creators. Browse briefs, rates, and locations.',
    url: '/jobs',
  },
}

export default async function PublicJobsPage() {
  const supabase = createAnonClient()

  const [feed, counts] = await Promise.all([
    fetchDiscoverJobs(
      supabase,
      { categories: [], search: '', workType: 'all', location: null, budgetBand: 'any', sort: 'newest' },
      { cursor: null, source: 'public' }
    ),
    supabase.rpc('open_job_category_counts'),
  ])

  // At runtime, throwing on failure keeps ISR serving the last good page
  // instead of caching an empty "0 open jobs" render for 5 minutes. Build
  // machines (CI) run with a placeholder Supabase URL, so the build phase
  // renders the empty shell instead - the first successful revalidation
  // fills it with real data.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  if (!feed.ok && !isBuildPhase) throw new Error('Jobs feed unavailable')

  const initialPage = feed.ok ? feed.page : { jobs: [], nextCursor: null, total: null }
  const categoryCounts: Partial<Record<Category, number>> = {}
  for (const row of (counts.data ?? []) as { category: Category; job_count: number }[]) {
    categoryCounts[row.category] = Number(row.job_count)
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="space-y-2 pt-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Creative jobs, open to applications</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Casting calls and paid briefs from real hirers - dance, acting, and content creation. Browse freely; create
          an account when you are ready to apply.
        </p>
      </header>

      <PublicJobsExplorer initialPage={initialPage} categoryCounts={categoryCounts} />
    </div>
  )
}
