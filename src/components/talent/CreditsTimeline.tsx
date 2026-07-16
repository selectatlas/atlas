import Image from 'next/image'
import { TrendingUp } from 'lucide-react'
import type { Credit } from '@/types'
import { CATEGORY_LABELS } from '@/lib/skills'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

interface CreditsTimelineProps {
  credits: Credit[]
}

const MAX_CASE_STUDIES = 2

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const startDate = new Date(start)
  const startStr = startDate.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })

  if (!end) return `${startStr} – Present`
  const endDate = new Date(end)
  const endStr = endDate.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
  return `${startStr} – ${endStr}`
}

function durationString(start: string | null, end: string | null): string | null {
  if (!start) return null
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (months < 1) return null
  if (months < 12) return `${months} mo${months > 1 ? 's' : ''}`
  const years = Math.floor(months / 12)
  const remaining = months % 12
  if (remaining === 0) return `${years} yr${years > 1 ? 's' : ''}`
  return `${years} yr ${remaining} mo`
}

function CaseStudyCard({ credit }: { credit: Credit }) {
  return (
    <Card className="border border-border/80 p-5 shadow-none">
      <div className="flex items-start gap-3">
        {(credit.client_logo_url || credit.media_url) && (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image
              src={credit.client_logo_url ?? credit.media_url!}
              alt={credit.company ?? credit.production}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{credit.production}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {credit.title}
            {credit.company ? ` · ${credit.company}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            {formatDateRange(credit.start_date, credit.end_date)}
          </p>
        </div>
      </div>

      {credit.description && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{credit.description}</p>
      )}

      {credit.outcome && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs font-medium">
          <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {credit.outcome}
        </p>
      )}
    </Card>
  )
}

export function CreditsTimeline({ credits }: CreditsTimelineProps) {
  if (credits.length === 0) return null

  const caseStudies = credits.filter(credit => credit.outcome).slice(0, MAX_CASE_STUDIES)
  const caseStudyIds = new Set(caseStudies.map(credit => credit.id))
  const timelineCredits = credits.filter(credit => !caseStudyIds.has(credit.id))

  return (
    <div>
      <h2 className="text-sm font-semibold mb-4">Credits & Experience</h2>

      {caseStudies.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {caseStudies.map(credit => (
            <CaseStudyCard key={credit.id} credit={credit} />
          ))}
        </div>
      )}

      {timelineCredits.length > 0 && (
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {timelineCredits.map((credit, i) => {
            const duration = durationString(credit.start_date, credit.end_date)
            return (
              <div key={credit.id} className="relative">
                {/* Timeline dot */}
                <div
                  className={`absolute -left-[23px] top-2 w-3 h-3 rounded-full border-2 ${
                    i === 0
                      ? 'bg-primary border-primary'
                      : 'bg-background border-border'
                  }`}
                />

                {/* Credit card */}
                <Card className="p-4 hover:border-muted-foreground/20 transition-colors">
                  <div className="flex items-start gap-3">
                    {credit.media_url && (
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                        <Image
                          src={credit.media_url}
                          alt={credit.production}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight">
                        {credit.title}
                      </h3>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {credit.production}
                        {credit.company ? ` · ${credit.company}` : ''}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-muted-foreground/70 text-xs">
                          {formatDateRange(credit.start_date, credit.end_date)}
                        </span>
                        {duration && (
                          <span className="text-muted-foreground/50 text-xs">· {duration}</span>
                        )}
                      </div>

                      {credit.category && (
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {CATEGORY_LABELS[credit.category]}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {credit.description && (
                    <p className="text-muted-foreground text-xs leading-relaxed mt-3 line-clamp-3">
                      {credit.description}
                    </p>
                  )}

                  {credit.outcome && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium">
                      <TrendingUp className="mt-0.5 size-3 shrink-0 text-primary" />
                      {credit.outcome}
                    </p>
                  )}
                </Card>
              </div>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}
