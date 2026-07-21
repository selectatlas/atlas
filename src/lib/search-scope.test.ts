import { describe, expect, it } from 'vitest'
import {
  availableScopes,
  canUseScope,
  resolveScope,
  scopeLabel,
  scopePlaceholder,
  scopeSearchTarget,
  scopeTriggerLabel,
} from './search-scope'

describe('availableScopes', () => {
  it('denies hirers the jobs scope (no hirer job-search surface)', () => {
    expect(availableScopes('hirer')).toEqual(['talent', 'global'])
  })

  it('denies talent the talent scope (/api/search is hirer-only)', () => {
    expect(availableScopes('talent')).toEqual(['jobs', 'global'])
  })

  it('lets signed-out visitors reach both marketplace scopes', () => {
    expect(availableScopes('public')).toEqual(['talent', 'jobs', 'global'])
  })
})

describe('canUseScope', () => {
  it('gates talent scope to hirers and the public', () => {
    expect(canUseScope('talent', 'hirer')).toBe(true)
    expect(canUseScope('talent', 'public')).toBe(true)
    expect(canUseScope('talent', 'talent')).toBe(false)
  })

  it('always allows global', () => {
    for (const audience of ['hirer', 'talent', 'public'] as const) {
      expect(canUseScope('global', audience)).toBe(true)
    }
  })
})

describe('resolveScope', () => {
  it('scopes the hirer search page to talent', () => {
    expect(resolveScope('/search', 'hirer')).toBe('talent')
  })

  it('scopes the talent discover feed to jobs', () => {
    expect(resolveScope('/discover', 'talent')).toBe('jobs')
  })

  it('scopes the public explorers for signed-out visitors', () => {
    expect(resolveScope('/talent', 'public')).toBe('talent')
    expect(resolveScope('/jobs', 'public')).toBe('jobs')
  })

  it('scopes detail routes to their parent surface', () => {
    expect(resolveScope('/talent/abc-123', 'hirer')).toBe('talent')
    expect(resolveScope('/jobs/abc-123', 'public')).toBe('jobs')
  })

  it('keeps /my-jobs global - it manages postings, it does not search them', () => {
    expect(resolveScope('/my-jobs', 'hirer')).toBe('global')
    expect(resolveScope('/my-jobs/abc-123', 'hirer')).toBe('global')
  })

  it('falls back to global on unrecognised routes', () => {
    expect(resolveScope('/messages', 'hirer')).toBe('global')
    expect(resolveScope('/settings', 'talent')).toBe('global')
    expect(resolveScope('/', 'public')).toBe('global')
  })

  it('falls back to global when the route scope is off-limits for the audience', () => {
    // A talent account browsing a talent profile cannot run talent search.
    expect(resolveScope('/talent/abc-123', 'talent')).toBe('global')
    // A hirer on a job detail page cannot run job search.
    expect(resolveScope('/jobs/abc-123', 'hirer')).toBe('global')
  })

  it('ignores a query string on the pathname', () => {
    expect(resolveScope('/search?q=dancers', 'hirer')).toBe('talent')
  })
})

describe('labels and placeholders', () => {
  it('names each scope for the pill', () => {
    expect(scopeLabel('talent')).toBe('Talent')
    expect(scopeLabel('jobs')).toBe('Jobs')
    expect(scopeLabel('global')).toBe('All')
  })

  it('mirrors the page in the placeholder', () => {
    expect(scopePlaceholder('talent')).toContain('Bollywood dancers in London')
    expect(scopePlaceholder('jobs')).toContain('jobs')
    expect(scopePlaceholder('global')).toContain('messages')
  })

  it('gives the top-bar trigger a short label', () => {
    expect(scopeTriggerLabel('talent')).toBe('Search talent')
    expect(scopeTriggerLabel('jobs')).toBe('Search jobs')
    expect(scopeTriggerLabel('global')).toBe('Search')
  })
})

describe('scopeSearchTarget', () => {
  it('routes signed-in users to the authed surfaces', () => {
    expect(scopeSearchTarget('talent', 'hirer')).toBe('/search')
    expect(scopeSearchTarget('jobs', 'talent')).toBe('/discover')
  })

  it('routes signed-out visitors to the public explorers', () => {
    expect(scopeSearchTarget('talent', 'public')).toBe('/talent')
    expect(scopeSearchTarget('jobs', 'public')).toBe('/jobs')
  })

  it('sends global to the audience default surface', () => {
    expect(scopeSearchTarget('global', 'hirer')).toBe('/search')
    expect(scopeSearchTarget('global', 'talent')).toBe('/discover')
  })
})
