import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORY_LABELS } from '@/lib/skills'
import {
  cursorPredicate,
  decodeCursor,
  encodeCursor,
  sanitizeSearchTerm,
  type DiscoverCursor,
} from '@/lib/job-discovery'
import type { Category } from '@/types'

// Public talent marketplace feed: the anon-facing mirror of job discovery,
// backed by the public_talent_profiles view (migration 031). The view is the
// security boundary - this module only filters and paginates within it.

export const TALENT_PAGE_SIZE = 24

export interface PublicTalentFilters {
  category: Category | null
  search: string
}

export interface PublicTalentRow {
  id: string
  full_name: string
  avatar_url: string | null
  headline: string | null
  city: string | null
  country: string | null
  rates: string | null
  availability: string | null
  verified_at: string | null
  created_at: string
  categories: Category[]
  skills: string[]
}

export interface PublicTalentPage {
  talent: PublicTalentRow[]
  nextCursor: string | null
  /** Total matching rows; only computed on the first page (null afterwards). */
  total: number | null
}

// Explicit column list: keeps search_text out of the payload (ilike filters
// on it without selecting it).
export const PUBLIC_TALENT_COLUMNS =
  'id, full_name, avatar_url, headline, city, country, rates, availability, verified_at, created_at, categories, skills'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

export function parsePublicTalentParams(params: URLSearchParams):
  | { ok: true; filters: PublicTalentFilters; cursor: DiscoverCursor | null }
  | { ok: false; error: string } {
  const rawCategory = params.get('category')
  if (rawCategory && !CATEGORIES.includes(rawCategory as Category)) {
    return { ok: false, error: `category must be one of: ${CATEGORIES.join(', ')}` }
  }

  const rawCursor = params.get('cursor')
  const cursor = decodeCursor(rawCursor)
  if (rawCursor && !cursor) return { ok: false, error: 'cursor is not valid' }

  return {
    ok: true,
    filters: {
      category: rawCategory ? (rawCategory as Category) : null,
      search: sanitizeSearchTerm(params.get('q') ?? ''),
    },
    cursor,
  }
}

export async function fetchPublicTalent(
  supabase: SupabaseClient,
  filters: PublicTalentFilters,
  cursor: DiscoverCursor | null,
): Promise<{ ok: true; page: PublicTalentPage } | { ok: false }> {
  let query = supabase
    .from('public_talent_profiles')
    .select(PUBLIC_TALENT_COLUMNS, cursor ? undefined : { count: 'exact' })

  if (filters.category) query = query.contains('categories', [filters.category])
  // search_text is a lowercased name+headline+location+skills blob in the
  // view; the term is already sanitized for PostgREST syntax.
  if (filters.search) query = query.ilike('search_text', `%${filters.search}%`)

  // Keyset pagination on (created_at, id), same shape as the jobs feed.
  if (cursor) query = query.or(cursorPredicate('newest', cursor))

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(TALENT_PAGE_SIZE + 1)

  if (error) return { ok: false }

  const rows = (data ?? []) as unknown as PublicTalentRow[]
  const talent = rows.slice(0, TALENT_PAGE_SIZE)
  const last = talent[talent.length - 1]
  const nextCursor =
    rows.length > TALENT_PAGE_SIZE && last ? encodeCursor({ v: last.created_at, id: last.id }) : null

  return {
    ok: true,
    page: { talent, nextCursor, total: cursor ? null : count ?? null },
  }
}
