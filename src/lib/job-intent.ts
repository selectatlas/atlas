import {
  BUDGET_BANDS,
  WORK_TYPE_FILTERS,
  sanitizeSearchTerm,
  type BudgetBand,
  type DiscoverFilters,
  type WorkTypeFilter,
} from '@/lib/job-discovery'
import { CATEGORY_LABELS } from '@/lib/skills'
import type { ParsedJobQuery } from '@/lib/openai'
import type { Category } from '@/types'

// Maps a parsed natural-language job query onto the structured filters the
// discover feed already understands. Deliberately pure and lossy: the feed
// filters on budget *bands*, not arbitrary ranges, so a parsed rate range has
// to be snapped to the nearest band the database can actually answer.

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

/**
 * Snap a parsed day-rate range to a band the feed can query.
 *
 * The bands are coarse (<250, 250-500, >500) and the query may straddle them.
 * A floor at or above 500 is unambiguously the top band; a ceiling at or below
 * 250 is unambiguously the bottom one. Anything that spans a boundary stays
 * 'any' - a wrong band silently hides valid jobs, which is worse than not
 * filtering at all.
 *
 * The middle band requires BOTH bounds. An open-ended floor ("over £300") is
 * unbounded above, so it also covers the >500 band: snapping it to 250-500
 * would hide every job paying more than the user asked for.
 */
export function rateRangeToBand(min: number | null, max: number | null): BudgetBand {
  if (min === null && max === null) return 'any'
  if (min !== null && min >= 500) return 'over500'
  if (max !== null && max <= 250) return 'under250'
  if (min !== null && max !== null && min >= 250 && max <= 500) return '250to500'
  return 'any'
}

function normaliseWorkType(value: string | null): WorkTypeFilter {
  if (value && (WORK_TYPE_FILTERS as readonly string[]).includes(value)) {
    return value as WorkTypeFilter
  }
  return 'all'
}

function normaliseCategory(value: string | null): Category[] {
  return value && CATEGORIES.includes(value as Category) ? [value as Category] : []
}

/**
 * Words that describe the *act of looking for work* rather than the work
 * itself. A job seeker types them constantly ("dance jobs in London") and a
 * posting never contains them.
 *
 * This matters because the feed's full-text search uses `websearch` mode,
 * which is AND-semantics: one unmatchable word zeroes the entire result set.
 * Live check against the seeded data - "dance jobs London" returns 0 jobs,
 * "dance London" returns 2, "London" returns 7.
 */
const QUERY_FILLER = new Set([
  'job', 'jobs', 'work', 'working', 'role', 'roles', 'gig', 'gigs',
  'opportunity', 'opportunities', 'position', 'positions', 'vacancy',
  'vacancies', 'looking', 'hiring', 'wanted', 'needed', 'available',
  'paying', 'paid', 'pay', 'rate', 'day', 'near', 'me', 'any', 'some',
])

/** Drop filler words so one unmatchable token cannot zero an AND query. */
export function stripQueryFiller(term: string): string {
  return term
    .split(/\s+/)
    .filter(word => word.length > 0 && !QUERY_FILLER.has(word.toLowerCase()))
    .join(' ')
}

/**
 * The free-text remainder that needs full-text search: role, location and any
 * leftover keywords.
 *
 * Location belongs here rather than in the structured `location` filter, which
 * matches with `.eq()`. That filter is fed by a dropdown of values that exist
 * in the data, so exact matching is right for it - but a parsed location is
 * free text. Real postings store "London, UK" while the parser yields
 * "London", so the exact filter returns 1 job where full-text returns 7.
 *
 * Rate and work type stay out: they map cleanly onto structured filters, and
 * repeating them here would over-constrain the query.
 */
export function jobSearchTerm(parsed: ParsedJobQuery): string {
  const parts = [parsed.role, parsed.location, ...parsed.keywords].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  )
  return sanitizeSearchTerm(stripQueryFiller(parts.join(' ').trim()))
}

/**
 * Build the discover filters for a parsed job query. `sort` is relevance when
 * there is a term to rank against, newest otherwise - matching how the
 * discover page already decides its default sort.
 */
export function jobIntentToFilters(parsed: ParsedJobQuery): DiscoverFilters {
  const search = jobSearchTerm(parsed)
  return {
    categories: normaliseCategory(parsed.category),
    search,
    workType: normaliseWorkType(parsed.work_type),
    // Deliberately null: see jobSearchTerm. A parsed location goes through
    // full-text search, never through this exact-match filter.
    location: null,
    budgetBand: rateRangeToBand(parsed.rate_min, parsed.rate_max),
    sort: search ? 'relevance' : 'newest',
  }
}

/** True when the parse produced nothing worth querying on. */
export function isEmptyJobIntent(parsed: ParsedJobQuery): boolean {
  const filters = jobIntentToFilters(parsed)
  return (
    filters.categories.length === 0 &&
    !filters.search &&
    filters.workType === 'all' &&
    !filters.location &&
    filters.budgetBand === 'any' &&
    !parsed.availability
  )
}

/** Human-readable chips describing what the parser understood. */
export function jobIntentChips(parsed: ParsedJobQuery): string[] {
  const chips: string[] = []
  if (parsed.category && CATEGORIES.includes(parsed.category as Category)) {
    chips.push(CATEGORY_LABELS[parsed.category as Category])
  }
  if (parsed.role) chips.push(parsed.role)
  if (parsed.location) chips.push(parsed.location)
  if (parsed.work_type && (WORK_TYPE_FILTERS as readonly string[]).includes(parsed.work_type)) {
    chips.push(parsed.work_type.replace('_', ' '))
  }
  if (parsed.availability) chips.push(parsed.availability)

  const band = rateRangeToBand(parsed.rate_min, parsed.rate_max)
  if (band !== 'any' && (BUDGET_BANDS as readonly string[]).includes(band)) {
    if (band === 'under250') chips.push('Under £250/day')
    else if (band === '250to500') chips.push('£250-500/day')
    else chips.push('Over £500/day')
  }

  return chips.slice(0, 6)
}
