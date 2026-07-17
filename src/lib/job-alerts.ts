import { parseDiscoverParams, type DiscoverFilters } from '@/lib/job-discovery'

// Talent-side saved searches ("job alerts"). Filters are stored in the same
// param shape the discover page puts in its URL (category/work/loc/rate), so
// applying an alert is just writing its params back to the URL, and
// validation reuses the discover param parser.

export const MAX_JOB_ALERTS = 10

const FILTER_KEYS = ['category', 'work', 'loc', 'rate'] as const
export type JobAlertFilterKey = (typeof FILTER_KEYS)[number]
export type JobAlertFilters = Partial<Record<JobAlertFilterKey, string>>

export interface JobAlert {
  id: string
  name: string
  query: string
  filters: JobAlertFilters
  last_viewed_at: string
  created_at: string
  /** Jobs created since last_viewed_at that match; computed at read time. */
  new_count?: number
}

export interface JobAlertRow {
  id: string
  name: string
  query: string
  filters: unknown
  last_viewed_at: string
  created_at: string
}

export function sanitizeAlertFilters(raw: unknown): JobAlertFilters {
  if (typeof raw !== 'object' || raw === null) return {}
  const filters: JobAlertFilters = {}
  for (const key of FILTER_KEYS) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) filters[key] = value.trim().slice(0, 200)
  }
  return filters
}

/**
 * Rebuild validated discover filters from an alert's stored query + params.
 * Fails if the stored values no longer parse (e.g. a removed category).
 */
export function alertToDiscoverFilters(alert: { query: string; filters: JobAlertFilters }):
  | { ok: true; filters: DiscoverFilters }
  | { ok: false; error: string } {
  const params = new URLSearchParams()
  if (alert.query) params.set('q', alert.query)
  for (const key of FILTER_KEYS) {
    const value = alert.filters[key]
    if (value) params.set(key, value)
  }
  const parsed = parseDiscoverParams(params)
  if (!parsed.ok) return parsed
  return { ok: true, filters: parsed.filters }
}

export function parseJobAlertInput(body: Record<string, unknown>):
  | { ok: true; input: { name: string; query: string; filters: JobAlertFilters } }
  | { ok: false; error: string } {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return { ok: false, error: 'name is required (max 80 characters)' }

  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 200) : ''
  const filters = sanitizeAlertFilters(body.filters)

  if (!query && Object.keys(filters).length === 0) {
    return { ok: false, error: 'An alert needs a search term or at least one filter' }
  }

  const validated = alertToDiscoverFilters({ query, filters })
  if (!validated.ok) return validated

  return { ok: true, input: { name, query, filters } }
}

export function mapJobAlertRow(row: JobAlertRow, newCount?: number): JobAlert {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    filters: sanitizeAlertFilters(row.filters),
    last_viewed_at: row.last_viewed_at,
    created_at: row.created_at,
    ...(newCount === undefined ? {} : { new_count: newCount }),
  }
}
