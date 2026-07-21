// Images shown in the talent-card carousel (client feedback 20 Jul 2026):
// hirers cycle through a talent's images without opening the profile.
// Stage 1 feeds from avatar + portfolio images with a flat cap; when
// membership tiers land, the cap comes from the tier config instead.

export const CARD_IMAGE_CAP = 3

export function buildCardImages(
  avatarUrl: string | null | undefined,
  portfolioImageUrls: ReadonlyArray<string | null | undefined>,
  cap: number = CARD_IMAGE_CAP,
): string[] {
  const seen = new Set<string>()
  const images: string[] = []
  for (const url of [avatarUrl, ...portfolioImageUrls]) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    images.push(url)
    if (images.length >= cap) break
  }
  return images
}
