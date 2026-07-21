import Link from 'next/link'
import { BadgeCheck, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { PublicTalentRow } from '@/lib/talent-discovery'

const MAX_SKILL_BADGES = 3

// Public marketplace talent card: a real anchor so crawlers and prefetch can
// follow it. The href is viewer-dependent (signup gate for anon, the full
// profile for signed-in hirers) - the explorer decides and passes it in.
export function PublicTalentCard({ talent, href, cta }: { talent: PublicTalentRow; href: string; cta: string }) {
  const location = [talent.city, talent.country].filter(Boolean).join(', ')
  const shownSkills = talent.skills.slice(0, MAX_SKILL_BADGES)
  const hiddenSkillCount = talent.skills.length - shownSkills.length

  return (
    <Link href={href} className="group/talent block">
      <Card className="flex h-full flex-col gap-3 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {talent.avatar_url && <AvatarImage src={talent.avatar_url} alt="" />}
            <AvatarFallback>{talent.full_name[0] ?? '?'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold leading-snug">
              <span className="truncate">{talent.full_name}</span>
              {talent.verified_at && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
                  <BadgeCheck className="size-3.5" />
                  Verified
                </span>
              )}
            </p>
            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" strokeWidth={1.5} />
                <span className="truncate">{location}</span>
              </p>
            )}
          </div>
        </div>

        {talent.headline && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{talent.headline}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {talent.rates && <span className="font-medium text-foreground">{talent.rates}</span>}
          {talent.availability && <span className="line-clamp-1">{talent.availability}</span>}
        </div>

        {shownSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shownSkills.map(skill => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {hiddenSkillCount > 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{hiddenSkillCount} more
              </Badge>
            )}
          </div>
        )}

        <span className="mt-auto inline-flex h-9 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-colors group-hover/talent:bg-accent/80">
          {cta}
        </span>
      </Card>
    </Link>
  )
}
