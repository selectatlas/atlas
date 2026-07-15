import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Award, Banknote, CalendarDays, Clapperboard, Eye, Heart, MapPin } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/skills'
import { TalentProfileShell } from '@/components/layout/TalentProfileShell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CoverPhoto } from '@/components/talent/CoverPhoto'
import { StatsBar } from '@/components/talent/StatsBar'
import { CreditsTimeline } from '@/components/talent/CreditsTimeline'
import { PortfolioGallery } from '@/components/talent/PortfolioGallery'
import { SimilarTalent } from '@/components/talent/SimilarTalent'
import { ContactButton } from '@/components/talent/ContactButton'
import { ShortlistButton } from '@/components/talent/ShortlistButton'
import { LikeButton } from '@/components/talent/LikeButton'
import { ViewTracker } from './ViewTracker'
import { TalentProfileDetails } from '@/components/talent/TalentProfileDetails'
import { SafetyActions } from '@/components/safety/SafetyActions'
import { getTalentProfile } from '@/lib/talent'
import type { Profile, TalentSkill } from '@/types'

const proficiencyVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  expert: 'default',
  advanced: 'secondary',
  intermediate: 'outline',
  beginner: 'outline',
}

const proficiencyLabel: Record<string, string> = {
  expert: 'Expert',
  advanced: 'Advanced',
  intermediate: 'Intermediate',
  beginner: 'Beginner',
}

export default async function TalentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getTalentProfile(id)

  if (!data) notFound()

  const { profile, credits, portfolioItems, likesCount, viewsCount, similarTalent, talentDetails } = data
  const skills = profile.talent_skills as TalentSkill[]
  const categories = [...new Set(skills.map(s => s.category))]

  const statsItems = []
  if (skills.length > 0) statsItems.push({ icon: Award, label: 'Skills', value: `${skills.length}` })
  if (credits.length > 0) statsItems.push({ icon: Clapperboard, label: 'Credits', value: `${credits.length}` })
  if (likesCount > 0) statsItems.push({ icon: Heart, label: 'Likes', value: `${likesCount}` })
  if (viewsCount > 0) statsItems.push({ icon: Eye, label: 'Views', value: `${viewsCount}` })
  if (profile.availability) statsItems.push({ icon: CalendarDays, label: 'Availability', value: profile.availability })
  if (profile.rates) statsItems.push({ icon: Banknote, label: 'Rate', value: profile.rates })

  return (
    <div className="pb-24">
      <ViewTracker talentId={id} />
      <TalentProfileShell name={profile.full_name} />

      {/* Hero Section */}
      <CoverPhoto coverUrl={profile.cover_url}>
        <div className="flex items-end gap-4">
          <div className="relative w-[88px] h-[88px] rounded-2xl overflow-hidden bg-muted border-4 border-background shrink-0 shadow-lg">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name}
                fill
                className="object-cover"
                sizes="88px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-muted-foreground/30">
                {profile.full_name[0]}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl font-bold leading-tight">{profile.full_name}</h1>
            {profile.headline && (
              <p className="text-muted-foreground text-sm mt-0.5">{profile.headline}</p>
            )}
            {(profile.city || profile.country) && (
              <p className="text-muted-foreground/70 text-xs mt-0.5">
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </p>
            )}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {categories.map(cat => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[cat]}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-1">
              <LikeButton talentId={profile.id} showCount={false} />
              <span className="text-[10px] font-medium text-muted-foreground">Like</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShortlistButton talentId={profile.id} />
              <span className="text-[10px] font-medium text-muted-foreground">Save</span>
            </div>
          </div>
        </div>
      </CoverPhoto>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-8">
          {statsItems.length > 0 && <StatsBar items={statsItems} />}

          {profile.bio && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">About</h2>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
            </section>
          )}

          <CreditsTimeline credits={credits} />

          <TalentProfileDetails details={talentDetails} />

          {skills.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Skills</h2>
              <div className="divide-y divide-border/70 rounded-xl border border-border/80 bg-card px-4">
                {skills.map(skill => (
                  <div key={skill.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm">{skill.skill}</span>
                    <Badge variant={proficiencyVariant[skill.proficiency]} className="text-xs">
                      {proficiencyLabel[skill.proficiency]}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          <PortfolioGallery items={portfolioItems} />

          {portfolioItems.length === 0 && profile.showreel_url && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Showreel</h2>
              <a href={profile.showreel_url} target="_blank" rel="noopener noreferrer">
                <Card className="flex items-center gap-3 border border-border/80 p-4 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Clapperboard className="size-5" />
                  </div>
                  <span className="text-sm font-medium">Watch showreel</span>
                </Card>
              </a>
            </section>
          )}

          <SimilarTalent talent={similarTalent} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          <Card className="border border-border/80 p-5 shadow-none">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">At a glance</p>
            <div className="space-y-4">
              {(profile.city || profile.country) && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Location</p><p className="mt-0.5 text-sm font-medium">{[profile.city, profile.country].filter(Boolean).join(', ')}</p></div>
                </div>
              )}
              {profile.availability && (
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Availability</p><p className="mt-0.5 text-sm font-medium">{profile.availability}</p></div>
                </div>
              )}
              {profile.rates && (
                <div className="flex items-start gap-3">
                  <Banknote className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Rate</p><p className="mt-0.5 text-sm font-medium">{profile.rates}</p></div>
                </div>
              )}
            </div>
          </Card>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">Review their work, then send a tailored outreach message when the fit feels right.</p>
          <SafetyActions profileId={profile.id} subjectLabel={profile.full_name} />
        </aside>
      </div>

      <ContactButton talent={profile as Profile & { talent_skills: TalentSkill[] }} />
    </div>
  )
}
