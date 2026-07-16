import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Award, Banknote, CalendarDays, Clapperboard, Eye, Heart, Star } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/skills'
import { TalentProfileShell } from '@/components/layout/TalentProfileShell'
import { Badge } from '@/components/ui/badge'
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
import { VerifiedBadge } from '@/components/talent/VerifiedBadge'
import { RatingStars } from '@/components/talent/RatingStars'
import { ReviewHighlights } from '@/components/talent/ReviewHighlights'
import { ReviewsSection } from '@/components/talent/ReviewsSection'
import { InlineShowreel } from '@/components/talent/InlineShowreel'
import { BookingCard } from '@/components/talent/BookingCard'
import { getTalentProfile } from '@/lib/talent'
import { getSession } from '@/lib/auth'
import { DEMO_PROFILE } from '@/lib/demo-data'
import { formatDayRate } from '@/lib/display'
import { formatRating } from '@/lib/reviews'
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

  // Hirers and admins can view any talent; talent can only preview their own
  // public page (the proxy enforces the same rule before the request lands here).
  const { userId, accountType, isPlatformAdmin, isLocalDemo } = await getSession()
  const isOwner = userId === id || (isLocalDemo && accountType === 'talent' && id === DEMO_PROFILE.id)
  if (!isOwner && accountType !== 'hirer' && !isPlatformAdmin) redirect('/discover')

  const data = await getTalentProfile(id)

  if (!data) notFound()

  const {
    profile,
    credits,
    portfolioItems,
    likesCount,
    viewsCount,
    shortlistCount,
    reviews,
    reviewSummary,
    similarTalent,
    talentDetails,
  } = data
  const skills = profile.talent_skills as TalentSkill[]
  const categories = [...new Set(skills.map(s => s.category))]

  const averageRating = formatRating(reviewSummary.average)
  const dayRate = formatDayRate(talentDetails.rate_min, talentDetails.rate_max)

  // The first embeddable video leads the page as an inline showreel; keep it
  // out of the gallery grid so it doesn't appear twice.
  const showreelItem = portfolioItems.find(item => item.type === 'video') ?? null
  const galleryItems = showreelItem
    ? portfolioItems.filter(item => item.id !== showreelItem.id)
    : portfolioItems

  const statsItems = []
  if (reviewSummary.count > 0 && averageRating) {
    statsItems.push({ icon: Star, label: 'Rating', value: `${averageRating} (${reviewSummary.count})` })
  }
  if (skills.length > 0) statsItems.push({ icon: Award, label: 'Skills', value: `${skills.length}` })
  if (credits.length > 0) statsItems.push({ icon: Clapperboard, label: 'Credits', value: `${credits.length}` })
  if (likesCount > 0) statsItems.push({ icon: Heart, label: 'Likes', value: `${likesCount}` })
  if (viewsCount > 0) statsItems.push({ icon: Eye, label: 'Views', value: `${viewsCount}` })
  if (profile.availability) statsItems.push({ icon: CalendarDays, label: 'Availability', value: profile.availability })
  if (profile.rates) statsItems.push({ icon: Banknote, label: 'Rate', value: profile.rates })

  return (
    <div className="pb-24">
      {!isOwner && <ViewTracker talentId={id} />}
      <TalentProfileShell
        name={profile.full_name}
        parent={isOwner ? { label: 'My profile', href: '/profile' } : undefined}
      />

      {isOwner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">Preview mode.</span>{' '}
            <span className="text-muted-foreground">This is exactly how hirers see your profile.</span>
          </p>
          <Link href="/profile" className="shrink-0 text-sm font-medium text-primary hover:underline">
            Edit profile
          </Link>
        </div>
      )}

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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold leading-tight">{profile.full_name}</h1>
              <VerifiedBadge verifiedAt={profile.verified_at} categories={profile.verified_categories} />
            </div>
            {profile.headline && (
              <p className="text-muted-foreground text-sm mt-0.5">{profile.headline}</p>
            )}
            {reviewSummary.count > 0 && reviewSummary.average !== null && (
              <p className="mt-1 flex items-center gap-1.5 text-xs">
                <RatingStars rating={reviewSummary.average} />
                <span className="font-semibold">{averageRating}</span>
                <span className="text-muted-foreground">({reviewSummary.count} review{reviewSummary.count > 1 ? 's' : ''})</span>
              </p>
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

          {!isOwner && (
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
          )}
        </div>
      </CoverPhoto>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-8">
          {statsItems.length > 0 && <StatsBar items={statsItems} />}

          <ReviewHighlights reviews={reviews} />

          {showreelItem ? (
            <InlineShowreel url={showreelItem.url} title={showreelItem.title} />
          ) : profile.showreel_url ? (
            <InlineShowreel url={profile.showreel_url} />
          ) : null}

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

          <PortfolioGallery items={galleryItems} />

          <ReviewsSection reviews={reviews} summary={reviewSummary} />

          {!isOwner && <SimilarTalent talent={similarTalent} />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          <BookingCard
            talent={profile as Profile & { talent_skills: TalentSkill[] }}
            rateMin={talentDetails.rate_min}
            rateMax={talentDetails.rate_max}
            availableNow={talentDetails.available_now}
            responseTimeHours={talentDetails.response_time_hours}
            summary={reviewSummary}
            shortlistCount={shortlistCount}
            showActions={!isOwner}
          />
          {!isOwner && (
            <>
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">Review their work, then send a tailored outreach message when the fit feels right.</p>
              <SafetyActions profileId={profile.id} subjectLabel={profile.full_name} />
            </>
          )}
        </aside>
      </div>

      {!isOwner && (
        <ContactButton
          talent={profile as Profile & { talent_skills: TalentSkill[] }}
          rateLabel={dayRate}
          availableNow={talentDetails.available_now}
          ratingLabel={reviewSummary.count > 0 ? averageRating : null}
        />
      )}
    </div>
  )
}
