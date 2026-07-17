import Link from 'next/link'
import { CalendarDays, MapPin, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { JobCover } from '@/components/talent/JobCover'
import { CATEGORY_LABELS } from '@/lib/skills'
import { formatDate } from '@/lib/matching'
import type { JobFeedItem } from '@/lib/job-discovery'

// Server-compatible job card for the public marketplace: a real anchor to
// the detail page so crawlers (and prefetch) can follow it.
export function PublicJobCard({ job }: { job: JobFeedItem }) {
  const postedDate = formatDate(job.created_at)
  return (
    <Link href={`/jobs/${job.id}`} className="group/job block">
      <Card className="gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
        <JobCover
          coverUrl={job.cover_url}
          category={job.category}
          title={job.title}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-[16/9]"
        />
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{CATEGORY_LABELS[job.category]}</Badge>
            {job.budget && <Badge variant="secondary">{job.budget}</Badge>}
          </div>
          <h3 className="line-clamp-2 font-semibold leading-snug">{job.title}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" strokeWidth={1.5} />
              {job.hirer?.full_name ?? 'Creative team'}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" strokeWidth={1.5} />
              {job.location}
            </span>
            {postedDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" strokeWidth={1.5} />
                {postedDate}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
