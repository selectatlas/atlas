// Scope resolution for the single, app-wide search box.
//
// One input lives in the nav. What it searches depends on where the user is
// standing: the Talent and Jobs surfaces scope the box to themselves,
// everywhere else it runs a grouped global lookup. Audience gates which
// scopes are reachable at all - `/api/search` is hirer-only (403 for talent
// accounts) and there is no hirer-facing job-search surface, so offering the
// wrong scope would produce a box that can only fail.

export type SearchScope = 'talent' | 'jobs' | 'global'

/** Who is doing the searching. `public` is the signed-out marketplace. */
export type SearchAudience = 'hirer' | 'talent' | 'public'

/**
 * Path prefixes that put the box into a scope. Order matters: the first
 * match wins, so more specific prefixes must come first.
 */
const SCOPE_PREFIXES: Array<{ prefix: string; scope: SearchScope }> = [
  // `/my-jobs` is the hirer's own postings manager, not job search - it must
  // be tested before `/jobs` so it falls through to global.
  { prefix: '/my-jobs', scope: 'global' },
  { prefix: '/search', scope: 'talent' },
  { prefix: '/talent', scope: 'talent' },
  { prefix: '/discover', scope: 'jobs' },
  { prefix: '/jobs', scope: 'jobs' },
]

export function availableScopes(audience: SearchAudience): SearchScope[] {
  if (audience === 'hirer') return ['talent', 'global']
  if (audience === 'talent') return ['jobs', 'global']
  return ['talent', 'jobs', 'global']
}

/** True when the audience is allowed to run this scope at all. */
export function canUseScope(scope: SearchScope, audience: SearchAudience): boolean {
  return availableScopes(audience).includes(scope)
}

/**
 * The scope implied by the current route, narrowed to what the audience can
 * actually run. Anything unrecognised - or recognised but off-limits - falls
 * back to global.
 */
export function resolveScope(pathname: string, audience: SearchAudience): SearchScope {
  const path = pathname.split('?')[0]
  const match = SCOPE_PREFIXES.find(
    entry => path === entry.prefix || path.startsWith(`${entry.prefix}/`),
  )
  if (!match) return 'global'
  return canUseScope(match.scope, audience) ? match.scope : 'global'
}

export function scopeLabel(scope: SearchScope): string {
  if (scope === 'talent') return 'Talent'
  if (scope === 'jobs') return 'Jobs'
  return 'All'
}

/** Placeholder mirrors the surface, so the box reads as part of the page. */
export function scopePlaceholder(scope: SearchScope): string {
  if (scope === 'talent') return 'Search talent, try "Bollywood dancers in London, available December"'
  if (scope === 'jobs') return 'Search jobs, try "dance jobs in London paying over £300 a day"'
  return 'Search talent, jobs, messages and settings'
}

/** Short form for the narrow trigger button in the top bar. */
export function scopeTriggerLabel(scope: SearchScope): string {
  if (scope === 'talent') return 'Search talent'
  if (scope === 'jobs') return 'Search jobs'
  return 'Search'
}

/**
 * Where Enter navigates for a given scope. Kept separate from `getSearchTarget`
 * (which is account-type driven) because the box can be scoped to a surface
 * the account would not otherwise land on - a signed-out visitor on /jobs.
 */
export function scopeSearchTarget(scope: SearchScope, audience: SearchAudience): string {
  if (scope === 'talent') return audience === 'public' ? '/talent' : '/search'
  if (scope === 'jobs') return audience === 'public' ? '/jobs' : '/discover'
  return audience === 'hirer' ? '/search' : '/discover'
}
