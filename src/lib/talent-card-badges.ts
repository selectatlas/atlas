// Capability badges surfaced on talent cards (client feedback 20 Jul 2026):
// SPAC (special action) and stunt-register status shown as yes/no signals at
// the point of discovery, without exposing the full attribute record.

export interface TalentCardBadges {
  spact: boolean
  stuntRegistered: boolean
}

export function cardBadgesFromAttributes(attributes: Record<string, unknown> | null | undefined): TalentCardBadges {
  return {
    spact: attributes?.spact === true,
    stuntRegistered: attributes?.stunt_register === true,
  }
}

/** True when at least one badge would render - lets callers skip empty rows. */
export function hasCardBadges(badges: TalentCardBadges | undefined): badges is TalentCardBadges {
  return badges !== undefined && (badges.spact || badges.stuntRegistered)
}
