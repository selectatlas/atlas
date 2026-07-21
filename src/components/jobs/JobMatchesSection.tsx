'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { VerifiedBadge } from '@/components/talent/VerifiedBadge'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import type { Job, Profile, TalentSkill, TalentSearchResult } from '@/types'

type MatchedTalent = Profile & { talent_skills: TalentSkill[] }

function locationFor(profile: Profile) {
  return [profile.city, profile.country].filter(Boolean).join(', ')
}

// Rates are stored as free text ("£350 per day"); show the headline figure only.
function rateFor(profile: Profile) {
  return profile.rates?.split('/')[0].trim() || null
}

interface JobMatchRowProps {
  match: TalentSearchResult
  invited: boolean
  onInvite: (talent: MatchedTalent) => void
}

// Purpose-built for the job page's narrow main column. TalentListItem is a
// full-width table row with fixed location/skills/rate/availability columns,
// which collapse the name to an ellipsis at this width - so this stacks the
// same facts vertically instead of competing for horizontal space.
function JobMatchRow({ match, invited, onInvite }: JobMatchRowProps) {
  const profile = match.profile as MatchedTalent
  const location = locationFor(profile)
  const rate = rateFor(profile)
  const reasons = match.match_reasons ?? []

  return (
    <Card className="border-border/80 hover:border-primary/35 p-3 shadow-none transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]">
      <div className="flex items-start gap-3">
        <Link
          href={`/talent/${profile.id}`}
          className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-lg"
        >
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <span className="text-muted-foreground/40 flex size-full items-center justify-center text-lg font-semibold">
              {profile.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link href={`/talent/${profile.id}`} className="truncate text-sm font-semibold hover:underline">
              {profile.full_name}
            </Link>
            <VerifiedBadge verifiedAt={profile.verified_at} categories={profile.verified_categories} compact />
            <span className="bg-brand-lime ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-black">
              {match.match_score}% match
            </span>
          </div>

          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {profile.headline || 'Creative talent'}
          </p>

          {/* One calm metadata line: the practical facts, in priority order,
              each able to drop out without leaving a dangling separator. */}
          <div className="text-muted-foreground mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            )}
            {rate && (
              <>
                <span aria-hidden className="text-border">·</span>
                <span className="text-foreground/75 font-medium">{rate}</span>
              </>
            )}
            {profile.availability && (
              <>
                <span aria-hidden className="text-border">·</span>
                <span className="line-clamp-1 min-w-0">{profile.availability}</span>
              </>
            )}
          </div>

          {reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Why this talent matches">
              {reasons.slice(0, 3).map(reason => (
                <Badge key={reason} variant="secondary" className="px-1.5 text-[10px] font-normal">
                  {reason}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant={invited ? 'ghost' : 'outline'}
          size="sm"
          className="shrink-0"
          disabled={invited}
          onClick={() => onInvite(profile)}
        >
          {invited ? 'Invited' : 'Invite'}
        </Button>
      </div>
    </Card>
  )
}

export interface JobMatchesSectionProps {
  job: Job
}

// The payoff of posting: talent ranked against this brief, ready to invite.
// Scores are the real pgvector similarity, never placeholders.
export function JobMatchesSection({ job }: JobMatchesSectionProps) {
  const [matches, setMatches] = useState<TalentSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [inviteTarget, setInviteTarget] = useState<MatchedTalent | null>(null)
  const [invited, setInvited] = useState<Set<string>>(new Set())

  const isOpen = job.status === 'open'

  useEffect(() => {
    // A closed job renders nothing at all, so there is no state to settle.
    if (!isOpen) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setFailed(false)
      try {
        const res = await fetch(`/api/jobs/${job.id}/matches`)
        if (cancelled) return
        if (!res.ok) { setFailed(true); return }
        const data = await res.json()
        if (cancelled) return
        setMatches(Array.isArray(data.matches) ? data.matches : [])
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [job.id, isOpen, attempt])

  if (!isOpen) return null

  return (
    <section aria-label="Talent that matches this brief" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="text-primary size-4 shrink-0" />
        <span className="text-muted-foreground text-xs font-medium">AI · Matched from your brief</span>
      </div>

      <h2 className="text-lg font-semibold tracking-tight">Talent that matches this brief</h2>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <Card key={i} className="border-border/80 p-3 shadow-none">
              <div className="flex items-start gap-3">
                <Skeleton className="size-12 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-16 shrink-0 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* A matching failure must never bury the applicants below it. */}
      {!loading && failed && (
        <p className="text-muted-foreground text-sm">
          Matches are unavailable right now.{' '}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => setAttempt(n => n + 1)}
          >
            Try again
          </Button>
        </p>
      )}

      {!loading && !failed && matches.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No strong matches yet.{' '}
          <Link href="/search" className="text-foreground underline underline-offset-4">
            Search for talent
          </Link>
        </p>
      )}

      {!loading && !failed && matches.length > 0 && (
        <div className="space-y-2">
          {matches.map(match => (
            <JobMatchRow
              key={(match.profile as MatchedTalent).id}
              match={match}
              invited={invited.has((match.profile as MatchedTalent).id)}
              onInvite={setInviteTarget}
            />
          ))}
        </div>
      )}

      {inviteTarget && (
        <OutreachModal
          talent={inviteTarget}
          job={{ id: job.id, title: job.title }}
          onClose={() => setInviteTarget(null)}
          onSent={() => {
            setInvited(current => new Set(current).add(inviteTarget.id))
            setInviteTarget(null)
          }}
        />
      )}
    </section>
  )
}
