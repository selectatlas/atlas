// Roster freshness is provenance (DESIGN.md, "Believable numbers need
// provenance"): pairing result counts with roster size and recency signals a
// live dataset. Values are always computed from real rows, never hardcoded.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function weekCutoffIso(now: Date = new Date()): string {
  return new Date(now.getTime() - WEEK_MS).toISOString()
}

export function rosterFreshnessLabel(
  total: number | null | undefined,
  addedThisWeek: number | null | undefined,
): string | null {
  if (typeof total !== 'number' || total <= 0) return null
  const profiles = `from ${total.toLocaleString('en-GB')} ${total === 1 ? 'profile' : 'profiles'}`
  if (typeof addedThisWeek !== 'number' || addedThisWeek <= 0) return profiles
  return `${profiles} · ${addedThisWeek.toLocaleString('en-GB')} added this week`
}
