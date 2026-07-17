'use client'

import Link from 'next/link'
import { Archive, ArrowUpRight, BadgeCheck, CircleSlash, FileText, PenLine, Send, Star, type LucideIcon } from 'lucide-react'
import { useAppShell } from '@/components/layout/app-shell-context'
import { formatMessageTime, type ThreadMessage } from '@/lib/messages-view'
import { systemCardTitle, type SystemMessageKind } from '@/lib/system-messages'

const KIND_ICONS: Record<SystemMessageKind, LucideIcon> = {
  application_received: FileText,
  outreach_sent: Send,
  application_shortlisted: Star,
  application_hired: BadgeCheck,
  application_declined: CircleSlash,
  review_published: PenLine,
  job_closed: Archive,
}

// Inline system card: thread events (application, outreach, shortlist,
// hire) render as a centred card, visually distinct from chat bubbles.
export function SystemMessageCard({
  message,
  kind,
  jobId,
}: {
  message: ThreadMessage
  kind: SystemMessageKind
  jobId: string | null
}) {
  const { accountType } = useAppShell()
  const Icon = KIND_ICONS[kind]
  // Job detail pages only exist for hirers; talent see the card without a link.
  const jobHref = accountType === 'hirer' && jobId ? `/my-jobs/${jobId}` : null

  return (
    <div className="flex justify-center py-1">
      <div className="w-full max-w-[380px] rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
              {systemCardTitle(kind)}
            </p>
            <p className="mt-0.5 break-words text-sm text-foreground">{message.content}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {formatMessageTime(message.created_at)}
              </span>
              {jobHref && (
                <Link
                  href={jobHref}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View job
                  <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
