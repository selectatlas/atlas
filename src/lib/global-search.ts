import { sanitizeSearchTerm } from '@/lib/job-discovery'

// Global search: the box outside Talent and Jobs. It is a *router*, not a
// ranker - it splits one query across the surfaces it could plausibly mean
// (people, jobs, conversations, settings) and groups whatever matched.
//
// Plain matching runs first because it is cheap, exact and predictable: a
// hirer typing a name they already know should not wait on an LLM. The AI
// parser is the fallback for when plain matching finds nothing at all.

/** Shortest query worth routing. Below this, matches are meaningless noise. */
export const MIN_GLOBAL_QUERY_LENGTH = 2

/** Per-category cap, so no single surface floods the grouped result list. */
export const GLOBAL_GROUP_LIMIT = 5

export type GlobalCategory = 'talent' | 'jobs' | 'messages' | 'settings'

export type GlobalHit = {
  id: string
  category: GlobalCategory
  title: string
  subtitle: string | null
  href: string
}

export type GlobalResults = Record<GlobalCategory, GlobalHit[]>

export const EMPTY_GLOBAL_RESULTS: GlobalResults = {
  talent: [], jobs: [], messages: [], settings: [],
}

/**
 * Normalise a raw query for use in `ilike` filters. Returns null when the
 * query is too short to route, so callers can skip the work entirely.
 */
export function normaliseGlobalTerm(raw: string): string | null {
  const term = sanitizeSearchTerm(raw ?? '')
  return term.length >= MIN_GLOBAL_QUERY_LENGTH ? term : null
}

/**
 * Static in-app destinations, matched by label and keyword. These never hit
 * the database - they are the "settings" category of the router.
 */
const DESTINATIONS: Array<{ id: string; title: string; href: string; keywords: string[] }> = [
  { id: 'settings', title: 'Settings', href: '/settings', keywords: ['account', 'preferences'] },
  { id: 'notifications', title: 'Notification settings', href: '/settings', keywords: ['alerts', 'email'] },
  { id: 'profile', title: 'My profile', href: '/profile', keywords: ['bio', 'photos', 'portfolio'] },
  { id: 'messages', title: 'Messages', href: '/messages', keywords: ['inbox', 'chat', 'conversations'] },
  { id: 'privacy', title: 'Privacy', href: '/privacy', keywords: ['data', 'gdpr', 'delete'] },
]

export function matchDestinations(term: string): GlobalHit[] {
  const needle = term.toLowerCase()
  return DESTINATIONS.filter(entry =>
    [entry.title, ...entry.keywords].some(text => text.toLowerCase().includes(needle)),
  )
    .slice(0, GLOBAL_GROUP_LIMIT)
    .map(entry => ({
      id: entry.id,
      category: 'settings' as const,
      title: entry.title,
      subtitle: null,
      href: entry.href,
    }))
}

/** Total hits across every category. */
export function countGlobalResults(results: GlobalResults): number {
  return (Object.keys(results) as GlobalCategory[])
    .reduce((total, key) => total + results[key].length, 0)
}

/**
 * The AI parser is worth running only when plain matching found nothing at
 * all. A single exact hit is a better answer than a semantic guess, and the
 * parser costs quota - so any hit at all suppresses the fallback.
 */
export function shouldFallbackToAi(results: GlobalResults): boolean {
  return countGlobalResults(results) === 0
}

/** Order categories are presented in: people first, admin last. */
export const GLOBAL_CATEGORY_ORDER: GlobalCategory[] = ['talent', 'jobs', 'messages', 'settings']

export const GLOBAL_CATEGORY_LABELS: Record<GlobalCategory, string> = {
  talent: 'Talent',
  jobs: 'Jobs',
  messages: 'Messages',
  settings: 'Pages & settings',
}

/** Drop empty groups and cap each surviving one, preserving category order. */
export function groupGlobalResults(results: GlobalResults): Array<{
  category: GlobalCategory
  label: string
  hits: GlobalHit[]
}> {
  return GLOBAL_CATEGORY_ORDER
    .map(category => ({
      category,
      label: GLOBAL_CATEGORY_LABELS[category],
      hits: results[category].slice(0, GLOBAL_GROUP_LIMIT),
    }))
    .filter(group => group.hits.length > 0)
}
