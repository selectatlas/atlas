export function nameInitial(name: string | null | undefined, fallback = '?'): string {
  const trimmed = name?.trim()
  if (!trimmed) return fallback
  return trimmed[0]!.toUpperCase()
}

export function formatDayRate(rateMin: number | null, rateMax: number | null): string | null {
  if (rateMin !== null && rateMax !== null) {
    return rateMin === rateMax ? `£${rateMin}/day` : `£${rateMin}–£${rateMax}/day`
  }
  if (rateMin !== null) return `From £${rateMin}/day`
  if (rateMax !== null) return `Up to £${rateMax}/day`
  return null
}

/**
 * Split a free-text rate string into the money and the unit so a card can
 * print the amount at display weight with the unit as a quiet second line.
 * Only the first rate is used - `rates` often carries several ("£300 per day
 * / £180 half day") and a card has room for one.
 */
export function splitRate(
  rates: string | null | undefined
): { amount: string; unit: string | null } | null {
  const first = rates?.split('/')[0]?.trim()
  if (!first) return null
  const match = first.match(/^([^\s]*\d[\d,.]*)\s*(.*)$/)
  if (!match) return { amount: first, unit: null }
  return { amount: match[1]!, unit: match[2]!.trim() || null }
}

export function portfolioImageAlt(item: {
  title?: string | null
  type: string
  description?: string | null
}): string {
  const title = item.title?.trim()
  if (title) return title
  const description = item.description?.trim()
  if (description) return description.slice(0, 120)
  if (item.type === 'video') return 'Portfolio video'
  if (item.type === 'image') return 'Portfolio image'
  return 'Portfolio link'
}
