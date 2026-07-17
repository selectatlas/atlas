// Spotlight boost - mockup-grade monetization surface (no billing, no schema).
// Pure countdown math for the "active boost" state shown on the talent side.

export const SPOTLIGHT_DURATION_DAYS = 7
export const SPOTLIGHT_PRICE_LABEL = '£14.99'

const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR
const SPOTLIGHT_DURATION_MS = SPOTLIGHT_DURATION_DAYS * MS_PER_DAY

export type SpotlightStatus = {
  active: boolean
  expiresAt: Date | null
  daysLeft: number
  hoursLeft: number
  /** 0-100, how much of the boost window is still remaining. */
  percentRemaining: number
}

const INACTIVE: SpotlightStatus = {
  active: false,
  expiresAt: null,
  daysLeft: 0,
  hoursLeft: 0,
  percentRemaining: 0,
}

/**
 * Computes the state of a 7-day Spotlight boost from its activation time.
 * Returns the inactive state for null, invalid, or expired activations.
 */
export function getSpotlightStatus(
  activatedAt: Date | string | null,
  now: Date = new Date(),
): SpotlightStatus {
  if (!activatedAt) return INACTIVE

  const start = typeof activatedAt === 'string' ? new Date(activatedAt) : activatedAt
  if (Number.isNaN(start.getTime())) return INACTIVE

  const expiresAt = new Date(start.getTime() + SPOTLIGHT_DURATION_MS)
  const remainingMs = Math.min(expiresAt.getTime() - now.getTime(), SPOTLIGHT_DURATION_MS)
  if (remainingMs <= 0) return INACTIVE

  return {
    active: true,
    expiresAt,
    daysLeft: Math.floor(remainingMs / MS_PER_DAY),
    hoursLeft: Math.floor((remainingMs % MS_PER_DAY) / MS_PER_HOUR),
    percentRemaining: Math.min(100, Math.round((remainingMs / SPOTLIGHT_DURATION_MS) * 100)),
  }
}

/** Formats an active status as a short countdown, e.g. "5 days 12 hrs left". */
export function formatSpotlightCountdown(status: SpotlightStatus): string {
  if (!status.active) return 'Not active'
  const { daysLeft, hoursLeft } = status
  if (daysLeft <= 0 && hoursLeft <= 0) return 'Less than 1 hr left'

  const parts: string[] = []
  if (daysLeft > 0) parts.push(`${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`)
  if (hoursLeft > 0) parts.push(`${hoursLeft} ${hoursLeft === 1 ? 'hr' : 'hrs'}`)
  return `${parts.join(' ')} left`
}

/**
 * Demo-only mock: an activation 36 hours in the past, so the preview always
 * renders a mid-run countdown (5 days 12 hrs left) regardless of wall clock.
 */
export function getMockSpotlightActivation(now: Date = new Date()): Date {
  return new Date(now.getTime() - 36 * MS_PER_HOUR)
}
