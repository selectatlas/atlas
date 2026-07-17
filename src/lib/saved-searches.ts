// Saved searches: pure domain logic. A saved search stores the hirer's
// natural-language query plus the structured filter set, so it can be
// re-run from anywhere and power read-time new-match alerts.

import { FILTER_BY_KEY } from '@/lib/filter-taxonomy'
import {
  parseSearchFilterObject,
  serializeSearchFilters,
  type SearchFilters,
} from '@/lib/search-filters'

export const SAVED_SEARCH_NAME_MAX = 80
export const SAVED_SEARCH_QUERY_MAX = 500
export const MAX_SAVED_SEARCHES = 20

export type SavedSearch = {
  id: string
  name: string
  query: string
  filters: SearchFilters
  lastViewedAt: string
  createdAt: string
}

export type SavedSearchRow = {
  id: string
  name: string
  query: string
  filters: unknown
  last_viewed_at: string
  created_at: string
}

export type SavedSearchInput = {
  name: string
  query: string
  filters: SearchFilters
}

export type SavedSearchInputResult =
  | { ok: true; input: SavedSearchInput }
  | { ok: false; error: string }

// Validates a create payload. Filters go through the shared search-filter
// parser so a saved search can never smuggle unknown keys into the RPC.
export function parseSavedSearchInput(body: Record<string, unknown>): SavedSearchInputResult {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length === 0 || name.length > SAVED_SEARCH_NAME_MAX) {
    return { ok: false, error: `name must be 1-${SAVED_SEARCH_NAME_MAX} characters` }
  }

  if (body.query !== undefined && body.query !== null && typeof body.query !== 'string') {
    return { ok: false, error: 'query must be a string' }
  }
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (query.length > SAVED_SEARCH_QUERY_MAX) {
    return { ok: false, error: `query must be at most ${SAVED_SEARCH_QUERY_MAX} characters` }
  }

  const parsedFilters = parseSearchFilterObject(body.filters ?? {})
  if (!parsedFilters.ok) return { ok: false, error: parsedFilters.error }

  if (query.length === 0 && Object.keys(parsedFilters.filters).length === 0) {
    return { ok: false, error: 'Save a query or at least one filter' }
  }

  return { ok: true, input: { name, query, filters: parsedFilters.filters } }
}

// Maps a database row to the domain shape, sanitising the stored filter
// JSON through the shared parser (bad or stale keys degrade to {}).
export function mapSavedSearchRow(row: SavedSearchRow): SavedSearch {
  const parsed = parseSearchFilterObject(row.filters ?? {})
  return {
    id: row.id,
    name: row.name,
    query: row.query ?? '',
    filters: parsed.ok ? parsed.filters : {},
    lastViewedAt: row.last_viewed_at,
    createdAt: row.created_at,
  }
}

// The run URL: the search page reads `q` and the filter params from the URL.
export function buildSavedSearchHref(search: Pick<SavedSearch, 'query' | 'filters'>): string {
  const params = serializeSearchFilters(search.filters)
  if (search.query) params.set('q', search.query)
  const encoded = params.toString()
  return encoded ? `/search?${encoded}` : '/search'
}

// Human subtitle for list rows: the query when there is one, otherwise the
// filter labels the search narrows by.
export function describeSavedSearch(search: Pick<SavedSearch, 'query' | 'filters'>): string {
  if (search.query) return search.query
  const labels = Object.keys(search.filters)
    .map(key => FILTER_BY_KEY.get(key)?.label)
    .filter((label): label is string => Boolean(label))
  if (labels.length === 0) return 'All talent'
  const shown = labels.slice(0, 3).join(' · ')
  return labels.length > 3 ? `${shown} +${labels.length - 3} more` : shown
}

export function newMatchesBody(count: number): string {
  return count === 1
    ? '1 new talent matches this search since you last ran it'
    : `${count} new talent match this search since you last ran it`
}
