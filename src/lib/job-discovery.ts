import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORY_LABELS } from '@/lib/skills'
import type { Category, Job } from '@/types'

// Server-driven talent job feed: filter/sort/paginate in Postgres and ship
// one page at a time, so the discover page scales past a handful of jobs.

export const DISCOVER_PAGE_SIZE = 24

// Passes are excluded from the feed via a NOT IN over the talent's most
// recent passes. Bounded so the query string cannot grow without limit;
// beyond this the oldest passes may resurface, which is acceptable.
export const MAX_EXCLUDED_PASSES = 500

export const JOB_SORTS = ['newest', 'rate_high', 'rate_low'] as const
export type JobSort = (typeof JOB_SORTS)[number]

export const WORK_TYPE_FILTERS = ['all', 'in_person', 'remote', 'hybrid'] as const
export type WorkTypeFilter = (typeof WORK_TYPE_FILTERS)[number]

export const BUDGET_BANDS = ['any', 'under250', '250to500', 'over500'] as const
export type BudgetBand = (typeof BUDGET_BANDS)[number]

export interface DiscoverFilters {
  /** Empty means all categories. Multiple entries cover multi-category talent. */
  categories: Category[]
  search: string
  workType: WorkTypeFilter
  location: string | null
  budgetBand: BudgetBand
  sort: JobSort
}

export interface DiscoverCursor {
  /** Sort-key value of the last row: created_at for newest, budget bound for rate sorts. */
  v: string | number | null
  id: string
}

export type JobFeedItem = Job & { hirer: { full_name: string } | null }

export interface DiscoverPage {
  jobs: JobFeedItem[]
  nextCursor: string | null
  /** Total matching rows; only computed on the first page (null afterwards). */
  total: number | null
}

/**
 * Lowest/highest number in a free-text budget ("£300 per day",
 * "£250 - £500"). Mirrors the SQL backfill in migration 021.
 */
export function parseBudgetRange(budget: string | null | undefined): { min: number | null; max: number | null } {
  if (!budget) return { min: null, max: null }
  const matches = budget.match(/\d[\d,]*/g)
  if (!matches) return { min: null, max: null }
  const values = matches
    .map(raw => raw.replace(/,/g, ''))
    .filter(raw => raw.length <= 9)
    .map(raw => parseInt(raw, 10))
  if (values.length === 0) return { min: null, max: null }
  return { min: Math.min(...values), max: Math.max(...values) }
}

export function encodeCursor(cursor: DiscoverCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function decodeCursor(raw: string | null | undefined): DiscoverCursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const { v, id } = parsed as { v?: unknown; id?: unknown }
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null
    if (v !== null && typeof v !== 'string' && typeof v !== 'number') return null
    if (typeof v === 'string' && (v.length > 64 || v.includes('"'))) return null
    return { v: v ?? null, id }
  } catch {
    return null
  }
}

/**
 * Strip characters that carry meaning in PostgREST filter syntax so the
 * term can be embedded in an `or=(...ilike...)` expression.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()"\\%_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

export function parseDiscoverParams(params: URLSearchParams):
  | { ok: true; filters: DiscoverFilters; cursor: DiscoverCursor | null; countOnly: boolean }
  | { ok: false; error: string } {
  // `category` accepts a comma-separated list so multi-category talent see
  // jobs across all of their disciplines, not just their first skill's.
  const rawCategories = params.get('category')
  const categories = (rawCategories ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (categories.some(value => !CATEGORIES.includes(value as Category))) {
    return { ok: false, error: `category must be one of: ${CATEGORIES.join(', ')}` }
  }

  const workType = params.get('work') ?? 'all'
  if (!WORK_TYPE_FILTERS.includes(workType as WorkTypeFilter)) {
    return { ok: false, error: `work must be one of: ${WORK_TYPE_FILTERS.join(', ')}` }
  }

  const budgetBand = params.get('rate') ?? 'any'
  if (!BUDGET_BANDS.includes(budgetBand as BudgetBand)) {
    return { ok: false, error: `rate must be one of: ${BUDGET_BANDS.join(', ')}` }
  }

  const sort = params.get('sort') ?? 'newest'
  if (!JOB_SORTS.includes(sort as JobSort)) {
    return { ok: false, error: `sort must be one of: ${JOB_SORTS.join(', ')}` }
  }

  const rawCursor = params.get('cursor')
  const cursor = decodeCursor(rawCursor)
  if (rawCursor && !cursor) return { ok: false, error: 'cursor is not valid' }

  const location = params.get('loc')?.trim().slice(0, 200) || null

  return {
    ok: true,
    filters: {
      categories: categories as Category[],
      search: sanitizeSearchTerm(params.get('q') ?? ''),
      workType: workType as WorkTypeFilter,
      location,
      budgetBand: budgetBand as BudgetBand,
      sort: sort as JobSort,
    },
    cursor,
    countOnly: params.get('count') === '1',
  }
}

/**
 * PostgREST `or=` expression continuing a keyset scan past the cursor row.
 * Ordering is always (sort key, id desc) with nulls last on rate sorts.
 */
export function cursorPredicate(sort: JobSort, cursor: DiscoverCursor): string {
  if (sort === 'newest') {
    return `created_at.lt."${cursor.v}",and(created_at.eq."${cursor.v}",id.lt.${cursor.id})`
  }
  const column = sort === 'rate_high' ? 'budget_max' : 'budget_min'
  if (cursor.v === null) {
    // Already inside the trailing null block; only the id tiebreak remains.
    return `and(${column}.is.null,id.lt.${cursor.id})`
  }
  const comparison = sort === 'rate_high' ? 'lt' : 'gt'
  return [
    `${column}.${comparison}.${cursor.v}`,
    `and(${column}.eq.${cursor.v},id.lt.${cursor.id})`,
    `${column}.is.null`,
  ].join(',')
}

function sortColumn(sort: JobSort): { column: 'created_at' | 'budget_max' | 'budget_min'; ascending: boolean } {
  if (sort === 'rate_high') return { column: 'budget_max', ascending: false }
  if (sort === 'rate_low') return { column: 'budget_min', ascending: true }
  return { column: 'created_at', ascending: false }
}

export interface DiscoverQueryOptions {
  cursor: DiscoverCursor | null
  excludeJobIds?: string[]
  /** Only compute the matching-row count (used by the filter sheet's live count). */
  countOnly?: boolean
}

export async function fetchDiscoverJobs(
  supabase: SupabaseClient,
  filters: DiscoverFilters,
  options: DiscoverQueryOptions,
): Promise<{ ok: true; page: DiscoverPage } | { ok: false }> {
  const attempt = await runDiscoverQuery(supabase, filters, options, 'fts')
  if (attempt.ok) return attempt
  // 42703 (missing search_tsv column) means migration 023 has not been
  // applied to this database yet: fall back to substring search so search
  // keeps working across deploy ordering.
  if (filters.search && attempt.code === '42703') {
    const fallback = await runDiscoverQuery(supabase, filters, options, 'ilike')
    if (fallback.ok) return fallback
  }
  return { ok: false }
}

async function runDiscoverQuery(
  supabase: SupabaseClient,
  filters: DiscoverFilters,
  options: DiscoverQueryOptions,
  searchMode: 'fts' | 'ilike',
): Promise<{ ok: true; page: DiscoverPage } | { ok: false; code: string | null }> {
  const { cursor, excludeJobIds = [], countOnly = false } = options
  const { column, ascending } = sortColumn(filters.sort)

  let query = countOnly
    ? supabase.from('jobs').select('id', { count: 'exact', head: true })
    : supabase
        .from('jobs')
        .select('*, hirer:profiles!hirer_id(full_name)', cursor ? undefined : { count: 'exact' })

  query = query.eq('status', 'open').is('removed_at', null)

  if (filters.categories.length > 0) query = query.in('category', filters.categories)
  if (filters.workType !== 'all') query = query.eq('work_type', filters.workType)
  if (filters.location) query = query.eq('location', filters.location)

  if (filters.budgetBand === 'under250') query = query.lt('budget_min', 250)
  if (filters.budgetBand === '250to500') query = query.gte('budget_max', 250).lte('budget_min', 500)
  if (filters.budgetBand === 'over500') query = query.gt('budget_max', 500)

  if (filters.search) {
    if (searchMode === 'fts') {
      query = query.textSearch('search_tsv', filters.search, { type: 'websearch', config: 'english' })
    } else {
      query = query.or(
        `title.ilike."%${filters.search}%",description.ilike."%${filters.search}%",location.ilike."%${filters.search}%"`,
      )
    }
  }

  if (excludeJobIds.length > 0) {
    query = query.not('id', 'in', `(${excludeJobIds.join(',')})`)
  }

  if (countOnly) {
    const { error, count } = await query
    if (error) return { ok: false, code: error.code ?? null }
    return { ok: true, page: { jobs: [], nextCursor: null, total: count ?? 0 } }
  }

  if (cursor) query = query.or(cursorPredicate(filters.sort, cursor))

  query = query
    .order(column, { ascending, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(DISCOVER_PAGE_SIZE + 1)

  const { data, error, count } = await query
  if (error) return { ok: false, code: error.code ?? null }

  const rows = (data ?? []) as JobFeedItem[]
  const jobs = rows.slice(0, DISCOVER_PAGE_SIZE)
  const last = jobs[jobs.length - 1]
  const nextCursor =
    rows.length > DISCOVER_PAGE_SIZE && last
      ? encodeCursor({ v: (last[column] ?? null) as string | number | null, id: last.id })
      : null

  return {
    ok: true,
    page: { jobs, nextCursor, total: cursor ? null : count ?? null },
  }
}
