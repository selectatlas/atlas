'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BriefcaseBusiness, Check, ChevronDown, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppShell } from '@/components/layout/app-shell-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { nameInitial } from '@/lib/display'
import { buildPreHireTimeline, type PreHireStage } from '@/lib/pre-hire-timeline'
import { PUBLIC_PROFILE_WITH_SKILLS } from '@/lib/profile-fields'
import type { ThreadOrigin } from '@/components/messages/types'

type RailProfile = {
  id: string
  account_type: 'hirer' | 'talent'
  full_name: string
  avatar_url: string | null
  headline: string | null
  city: string | null
  country: string | null
  bio: string | null
  rates: string | null
  availability: string | null
  showreel_url: string | null
  talent_skills: Array<{ id: string; skill: string }>
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border/80">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {title}
        <ChevronDown className={`size-3.5 transition-transform duration-[var(--duration-fast)] ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// Upwork-style pre-hire stepper: one dot per stage, connected by a vertical
// line, driven by the linked outreach/application status.
function StageTimeline({ stages, startedAt }: { stages: PreHireStage[]; startedAt: string | null }) {
  return (
    <ol className="mt-1">
      {stages.map((stage, index) => (
        <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
          {index < stages.length - 1 && (
            <span
              aria-hidden
              className={`absolute left-[8px] top-[18px] h-[calc(100%-18px)] w-px ${
                stages[index + 1].complete ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
          <span
            aria-hidden
            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
              stage.complete
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-muted'
            }`}
          >
            {stage.complete && <Check className="size-2.5" strokeWidth={3} />}
          </span>
          <div className="min-w-0">
            <p
              className={`text-xs leading-4 ${
                stage.current
                  ? 'font-semibold text-foreground'
                  : stage.complete
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
              }`}
            >
              {stage.label}
            </p>
            {stage.key === 'started' && startedAt && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {new Date(startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

// Intercom-style details rail: the profile summary stays open, everything
// else is progressively disclosed so the conversation keeps visual focus.
export function ContextRail({
  otherId,
  otherName,
  origin,
  threadCreatedAt,
  messageCount,
}: {
  otherId: string | null
  otherName: string
  origin: ThreadOrigin
  threadCreatedAt: string | null
  messageCount: number
}) {
  const { accountType } = useAppShell()
  const [profile, setProfile] = useState<RailProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!otherId) {
        if (!cancelled) setLoading(false)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_WITH_SKILLS)
        .eq('id', otherId)
        .maybeSingle()
      if (cancelled) return
      setProfile((data as unknown as RailProfile | null) ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [otherId])

  const isTalentProfile = profile?.account_type === 'talent'
  const location = [profile?.city, profile?.country].filter(Boolean).join(', ')
  const timelineStages = buildPreHireTimeline(origin)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : (
          <>
            <div className="border-b border-border/80 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-12 rounded-xl">
                  <AvatarImage src={profile?.avatar_url ?? ''} alt={otherName} />
                  <AvatarFallback className="rounded-xl text-lg font-bold">
                    {nameInitial(otherName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{profile?.full_name ?? otherName}</p>
                  {(profile?.headline || location) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {profile?.headline ?? location}
                    </p>
                  )}
                </div>
              </div>
              {profile?.bio && (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{profile.bio}</p>
              )}
              {isTalentProfile && accountType === 'hirer' && otherId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full gap-1.5"
                  nativeButton={false}
                  render={<Link href={`/talent/${otherId}`} />}
                >
                  View full profile
                  <ExternalLink className="size-3.5" />
                </Button>
              )}
            </div>

            {isTalentProfile && (
              <Section title="Talent details" defaultOpen>
                <div className="space-y-2">
                  <Fact label="Location" value={location || null} />
                  <Fact label="Availability" value={profile?.availability ?? null} />
                  <Fact label="Rates" value={profile?.rates ?? null} />
                  {profile && profile.talent_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {profile.talent_skills.slice(0, 8).map(s => (
                        <Badge key={s.id} variant="secondary" className="rounded-md text-[11px]">
                          {s.skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {(origin.job_title || origin.outreach_id) && (
              <Section title="How it started" defaultOpen>
                <div className="space-y-3 text-sm">
                  {origin.job_title && origin.job_id && (
                    <Link
                      href={`/jobs/${origin.job_id}`}
                      className="flex items-center gap-2 rounded-lg border border-border/80 px-3 py-2 transition-colors hover:border-primary/35"
                    >
                      <BriefcaseBusiness className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{origin.job_title}</span>
                    </Link>
                  )}
                  {timelineStages.length > 0 && (
                    <StageTimeline stages={timelineStages} startedAt={origin.outreach_sent_at ?? threadCreatedAt} />
                  )}
                </div>
              </Section>
            )}

            <Section title="Conversation">
              <div className="space-y-2">
                <Fact
                  label="Started"
                  value={
                    threadCreatedAt
                      ? new Date(threadCreatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : null
                  }
                />
                <Fact label="Messages" value={String(messageCount)} />
              </div>
            </Section>
          </>
        )}
      </ScrollArea>
    </div>
  )
}
