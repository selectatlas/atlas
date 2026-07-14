import { Check, CircleAlert } from 'lucide-react'
import { getProfileCompleteness } from '@/lib/profile-completeness'
import { Card } from '@/components/ui/card'
import type { Credit, PortfolioItem, Profile, TalentSkill } from '@/types'
import type { TalentAttributesPayload } from '@/lib/talent-profile-attributes'

interface ProfileCompletenessCardProps {
  profile: Profile & { talent_skills: TalentSkill[]; credits: Credit[]; portfolio_items: PortfolioItem[] }
  attributes: TalentAttributesPayload
}

export function ProfileCompletenessCard({ profile, attributes }: ProfileCompletenessCardProps) {
  const { score, missing } = getProfileCompleteness(profile, attributes)
  const nextSteps = missing.slice(0, 2)

  return (
    <Card className="border-primary/20 bg-primary/5 p-5 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Profile strength</p>
          <h2 className="mt-1 text-base font-semibold">{score}% ready to be discovered</h2>
        </div>
        <span className="text-2xl font-bold text-primary">{score}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/70" role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--duration-base)]" style={{ width: `${score}%` }} />
      </div>
      {nextSteps.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-foreground/80">Next best updates</p>
          {nextSteps.map(item => (
            <div key={item.key} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span><strong className="font-medium text-foreground">{item.label}.</strong> {item.hint}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-xs text-emerald-700"><Check className="size-3.5" /> Your profile is ready for matching.</p>
      )}
    </Card>
  )
}
