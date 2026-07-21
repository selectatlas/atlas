'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TalentListItem } from '@/components/talent/TalentCard'
import { OutreachModal } from '@/components/outreach/OutreachModal'
import type { Job, Profile, TalentSkill, TalentSearchResult } from '@/types'

type MatchedTalent = Profile & { talent_skills: TalentSkill[] }

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
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
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
          {matches.map(match => {
            const profile = match.profile as MatchedTalent
            const alreadyInvited = invited.has(profile.id)
            return (
              <div key={profile.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TalentListItem
                    profile={profile}
                    matchScore={match.match_score}
                    matchReasons={match.match_reasons}
                    href={`/talent/${profile.id}`}
                  />
                </div>
                <Button
                  type="button"
                  variant={alreadyInvited ? 'ghost' : 'outline'}
                  size="sm"
                  className="shrink-0"
                  disabled={alreadyInvited}
                  onClick={() => setInviteTarget(profile)}
                >
                  {alreadyInvited ? 'Invited' : 'Invite'}
                </Button>
              </div>
            )
          })}
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
