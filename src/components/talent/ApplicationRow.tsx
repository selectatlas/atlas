import Link from 'next/link'
import { BriefcaseBusiness } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CATEGORY_LABELS } from '@/lib/skills'
import type { ApplicationStatus, Category } from '@/types'

const STATUS_VARIANTS: Record<ApplicationStatus, 'outline' | 'secondary' | 'default'> = {
  sent: 'outline', viewed: 'secondary', responded: 'default', shortlisted: 'default', hired: 'default', declined: 'outline',
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  sent: 'Sent', viewed: 'Viewed', responded: 'Replied', shortlisted: 'Shortlisted', hired: 'Hired', declined: 'Declined',
}

export interface ApplicationRowData {
  id: string
  status: ApplicationStatus
  created_at: string
  note: string | null
  /** True when the status changed since the talent last opened the applications page. */
  statusIsNew?: boolean
  job: {
    id: string
    title: string
    category: Category
    location: string
    removed: boolean
  } | null
}

export function ApplicationRow({ application }: { application: ApplicationRowData }) {
  const { job } = application
  const appliedOn = new Date(application.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const card = (
    <Card className="border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <BriefcaseBusiness className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job?.title ?? 'Job'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {job ? `${CATEGORY_LABELS[job.category]} · ${job.location}` : 'Details unavailable'}
            {' · '}Applied {appliedOn}
            {job?.removed && ' · No longer available'}
          </p>
          {application.note && (
            <p className="mt-1 truncate text-xs text-muted-foreground/80">&ldquo;{application.note}&rdquo;</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {application.statusIsNew && (
            <span className="size-2 rounded-full bg-primary" aria-label="Status updated" />
          )}
          <Badge variant={STATUS_VARIANTS[application.status]}>{STATUS_LABELS[application.status]}</Badge>
        </div>
      </div>
    </Card>
  )

  // Removed jobs keep the row (the application happened) but drop the link.
  return job && !job.removed ? (
    <Link href={`/discover/${job.id}`} aria-label={`Application for ${job.title}`}>{card}</Link>
  ) : (
    <div>{card}</div>
  )
}
