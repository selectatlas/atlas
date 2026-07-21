// Talent membership tiers - the single source of truth for every allowance
// in the client's pricing table (Atlas structure breakdown PDF, 20 Jul 2026,
// p.16-21). The database stores only profiles.membership_tier; every limit is
// derived here so UI lock states and server enforcement can never disagree.
//
// Admin-set only in this phase: no billing, no self-serve upgrade.

export const MEMBERSHIP_TIERS = ['free', 'gold', 'platinum'] as const
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number]

export interface TierAllowances {
  /** Card/profile main photos. All tiers include the 4 labeled identity slots; this caps the total main set. */
  mainPhotos: number
  photoPortfolios: number
  imagesPerPortfolio: number
  videoPortfolios: number
  audioTracks: number
  /** Job applications per rolling week. */
  weeklyApplications: number
  /** Structured service packages a talent can list. */
  servicePackages: number
  /** Free custom (tailored) packages per client per week. */
  weeklyCustomPackagesPerClient: number
  /** Platform commission on transactions, as a percentage. */
  transactionFeePercent: number
  /** Platinum perk: rotates through the featured homepage placement. */
  featuredHomepage: boolean
}

export const TIER_ALLOWANCES: Record<MembershipTier, TierAllowances> = {
  free: {
    mainPhotos: 4,
    photoPortfolios: 1,
    imagesPerPortfolio: 10,
    videoPortfolios: 1,
    audioTracks: 5,
    weeklyApplications: 5,
    servicePackages: 3,
    weeklyCustomPackagesPerClient: 1,
    transactionFeePercent: 20,
    featuredHomepage: false,
  },
  gold: {
    mainPhotos: 10,
    photoPortfolios: 5,
    imagesPerPortfolio: 20,
    videoPortfolios: 5,
    audioTracks: 15,
    weeklyApplications: 20,
    servicePackages: 5,
    weeklyCustomPackagesPerClient: 3,
    transactionFeePercent: 15,
    featuredHomepage: false,
  },
  platinum: {
    mainPhotos: 20,
    photoPortfolios: 10,
    imagesPerPortfolio: 30,
    videoPortfolios: 10,
    audioTracks: 50,
    weeklyApplications: 80,
    servicePackages: 20,
    weeklyCustomPackagesPerClient: 10,
    transactionFeePercent: 0,
    featuredHomepage: true,
  },
}

export const TIER_LABELS: Record<MembershipTier, string> = {
  free: 'Free',
  gold: 'Gold',
  platinum: 'Platinum',
}

export function isMembershipTier(value: unknown): value is MembershipTier {
  return typeof value === 'string' && (MEMBERSHIP_TIERS as readonly string[]).includes(value)
}

/** Normalise a raw DB value; unknown/missing values read as free. */
export function membershipTierOf(value: unknown): MembershipTier {
  return isMembershipTier(value) ? value : 'free'
}

export function allowancesFor(tier: unknown): TierAllowances {
  return TIER_ALLOWANCES[membershipTierOf(tier)]
}

/** Carousel preview cap for the talent grid (PDF: 3 previews on free, more via arrows on gold/platinum). */
export function cardPreviewImageCap(tier: unknown): number {
  const resolved = membershipTierOf(tier)
  if (resolved === 'free') return 3
  return allowancesFor(resolved).mainPhotos
}
