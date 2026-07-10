import { TalentCard } from '@/components/talent/TalentCard'
import type { Profile, TalentSkill } from '@/types'

interface SimilarTalentProps {
  talent: Array<{ profile: Profile & { talent_skills: TalentSkill[] }; match_score: number }>
}

export function SimilarTalent({ talent }: SimilarTalentProps) {
  if (talent.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Similar Talent</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {talent.map(({ profile }) => (
          <div key={profile.id} className="shrink-0 w-[200px]">
            <TalentCard profile={profile} href={`/talent/${profile.id}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
