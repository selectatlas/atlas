import { describe, expect, it } from 'vitest'
import {
  allowancesFor,
  cardPreviewImageCap,
  isMembershipTier,
  membershipTierOf,
  MEMBERSHIP_TIERS,
  TIER_ALLOWANCES,
} from './membership'

describe('membership tiers', () => {
  it('defines exactly the three client tiers', () => {
    expect(MEMBERSHIP_TIERS).toEqual(['free', 'gold', 'platinum'])
  })

  it('matches the client pricing table allowances', () => {
    expect(TIER_ALLOWANCES.free).toMatchObject({ mainPhotos: 4, photoPortfolios: 1, weeklyApplications: 5, servicePackages: 3, transactionFeePercent: 20, audioTracks: 5 })
    expect(TIER_ALLOWANCES.gold).toMatchObject({ mainPhotos: 10, photoPortfolios: 5, weeklyApplications: 20, servicePackages: 5, transactionFeePercent: 15, audioTracks: 15 })
    expect(TIER_ALLOWANCES.platinum).toMatchObject({ mainPhotos: 20, photoPortfolios: 10, weeklyApplications: 80, servicePackages: 20, transactionFeePercent: 0, audioTracks: 50, featuredHomepage: true })
  })

  it('allowances never decrease when upgrading', () => {
    const numericKeys = ['mainPhotos', 'photoPortfolios', 'imagesPerPortfolio', 'videoPortfolios', 'audioTracks', 'weeklyApplications', 'servicePackages', 'weeklyCustomPackagesPerClient'] as const
    for (const key of numericKeys) {
      expect(TIER_ALLOWANCES.gold[key]).toBeGreaterThanOrEqual(TIER_ALLOWANCES.free[key])
      expect(TIER_ALLOWANCES.platinum[key]).toBeGreaterThanOrEqual(TIER_ALLOWANCES.gold[key])
    }
    // Fees go the other way.
    expect(TIER_ALLOWANCES.gold.transactionFeePercent).toBeLessThanOrEqual(TIER_ALLOWANCES.free.transactionFeePercent)
    expect(TIER_ALLOWANCES.platinum.transactionFeePercent).toBeLessThanOrEqual(TIER_ALLOWANCES.gold.transactionFeePercent)
  })

  it('normalises unknown values to free', () => {
    expect(membershipTierOf(undefined)).toBe('free')
    expect(membershipTierOf(null)).toBe('free')
    expect(membershipTierOf('vip')).toBe('free')
    expect(membershipTierOf('gold')).toBe('gold')
    expect(allowancesFor('nonsense')).toBe(TIER_ALLOWANCES.free)
  })

  it('validates tier strings', () => {
    expect(isMembershipTier('platinum')).toBe(true)
    expect(isMembershipTier('Platinum')).toBe(false)
    expect(isMembershipTier(2)).toBe(false)
  })

  it('caps free card previews at 3 and lifts the cap for paid tiers', () => {
    expect(cardPreviewImageCap('free')).toBe(3)
    expect(cardPreviewImageCap(undefined)).toBe(3)
    expect(cardPreviewImageCap('gold')).toBe(10)
    expect(cardPreviewImageCap('platinum')).toBe(20)
  })
})
