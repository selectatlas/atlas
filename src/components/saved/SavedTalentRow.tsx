'use client'

import Link from 'next/link'
import type { Profile, TalentSkill } from '@/types'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LikeButton } from '@/components/talent/LikeButton'
import { ShortlistButton } from '@/components/talent/ShortlistButton'
import { VerifiedBadge } from '@/components/talent/VerifiedBadge'
import { nameInitial } from '@/lib/display'

interface SavedTalentRowProps {
  talent: Profile & { talent_skills: TalentSkill[] }
  savedAt: string
}

export function SavedTalentRow({ talent, savedAt }: SavedTalentRowProps) {
  // Fixed timezone: this renders on the server too, and a server/client
  // timezone difference near midnight would be a hydration mismatch.
  const date = new Date(savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const skills = talent.talent_skills.slice(0, 3).map(s => s.skill).join(' · ')
  const location = [talent.city, talent.country].filter(Boolean).join(', ')

  return (
    <Card className="border border-border/80 p-4 shadow-none">
      <div className="flex items-center gap-3">
        <Link href={`/talent/${talent.id}`} className="shrink-0">
          <Avatar className="h-12 w-12 rounded-xl">
            <AvatarImage src={talent.avatar_url ?? ''} alt={talent.full_name} />
            <AvatarFallback className="rounded-xl text-lg font-bold">{nameInitial(talent.full_name)}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/talent/${talent.id}`} className="truncate text-sm font-semibold hover:text-primary">
              {talent.full_name}
            </Link>
            <VerifiedBadge
              verifiedAt={talent.verified_at}
              categories={talent.verified_categories}
              compact
            />
          </div>
          {talent.headline && (
            <p className="truncate text-xs text-muted-foreground">{talent.headline}</p>
          )}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[skills, location].filter(Boolean).join(' · ') || `Saved ${date}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <LikeButton talentId={talent.id} showCount={false} />
          <ShortlistButton talentId={talent.id} />
        </div>
      </div>
    </Card>
  )
}
