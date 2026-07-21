import { describe, expect, it } from 'vitest'
import {
  EMPTY_GLOBAL_RESULTS,
  GLOBAL_GROUP_LIMIT,
  countGlobalResults,
  groupGlobalResults,
  matchDestinations,
  normaliseGlobalTerm,
  shouldFallbackToAi,
  type GlobalHit,
  type GlobalResults,
} from './global-search'

function hit(id: string, category: GlobalHit['category']): GlobalHit {
  return { id, category, title: `title-${id}`, subtitle: null, href: `/${id}` }
}

function results(overrides: Partial<GlobalResults> = {}): GlobalResults {
  return { ...EMPTY_GLOBAL_RESULTS, ...overrides }
}

describe('normaliseGlobalTerm', () => {
  it('returns null for a query too short to route', () => {
    expect(normaliseGlobalTerm('')).toBeNull()
    expect(normaliseGlobalTerm('a')).toBeNull()
    expect(normaliseGlobalTerm('   ')).toBeNull()
  })

  it('accepts a two-character query', () => {
    expect(normaliseGlobalTerm('jo')).toBe('jo')
  })

  it('strips characters that carry meaning in PostgREST filter syntax', () => {
    const term = normaliseGlobalTerm('priya, (100%)_x')
    expect(term).not.toMatch(/[,()%_]/)
  })

  it('collapses whitespace', () => {
    expect(normaliseGlobalTerm('  music   video  ')).toBe('music video')
  })
})

describe('matchDestinations', () => {
  it('matches a destination by its title', () => {
    const hits = matchDestinations('settings')
    expect(hits.some(h => h.href === '/settings')).toBe(true)
  })

  it('matches a destination by keyword rather than title', () => {
    // "inbox" appears only in the keywords for Messages.
    const hits = matchDestinations('inbox')
    expect(hits.some(h => h.title === 'Messages')).toBe(true)
  })

  it('tags every hit as the settings category', () => {
    for (const h of matchDestinations('e')) expect(h.category).toBe('settings')
  })

  it('returns nothing for a term that matches no destination', () => {
    expect(matchDestinations('zzzqqq')).toEqual([])
  })

  it('never exceeds the per-group cap', () => {
    expect(matchDestinations('e').length).toBeLessThanOrEqual(GLOBAL_GROUP_LIMIT)
  })
})

describe('countGlobalResults', () => {
  it('sums hits across every category', () => {
    expect(countGlobalResults(results({
      talent: [hit('a', 'talent')],
      jobs: [hit('b', 'jobs'), hit('c', 'jobs')],
    }))).toBe(3)
  })

  it('is zero for an empty result set', () => {
    expect(countGlobalResults(EMPTY_GLOBAL_RESULTS)).toBe(0)
  })
})

describe('shouldFallbackToAi', () => {
  it('falls back only when plain matching found nothing at all', () => {
    expect(shouldFallbackToAi(EMPTY_GLOBAL_RESULTS)).toBe(true)
  })

  it('does not fall back when any single category matched', () => {
    expect(shouldFallbackToAi(results({ talent: [hit('a', 'talent')] }))).toBe(false)
    expect(shouldFallbackToAi(results({ settings: [hit('s', 'settings')] }))).toBe(false)
    expect(shouldFallbackToAi(results({ messages: [hit('m', 'messages')] }))).toBe(false)
  })
})

describe('groupGlobalResults', () => {
  it('drops empty categories', () => {
    const groups = groupGlobalResults(results({ jobs: [hit('j', 'jobs')] }))
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('jobs')
  })

  it('presents people before jobs before messages before settings', () => {
    const groups = groupGlobalResults(results({
      settings: [hit('s', 'settings')],
      messages: [hit('m', 'messages')],
      jobs: [hit('j', 'jobs')],
      talent: [hit('t', 'talent')],
    }))
    expect(groups.map(g => g.category)).toEqual(['talent', 'jobs', 'messages', 'settings'])
  })

  it('caps each group so one surface cannot flood the list', () => {
    const many = Array.from({ length: 20 }, (_, i) => hit(`t${i}`, 'talent'))
    const groups = groupGlobalResults(results({ talent: many }))
    expect(groups[0].hits).toHaveLength(GLOBAL_GROUP_LIMIT)
  })

  it('gives every group a human-readable label', () => {
    const groups = groupGlobalResults(results({ talent: [hit('t', 'talent')] }))
    expect(groups[0].label).toBe('Talent')
  })

  it('returns nothing for an empty result set', () => {
    expect(groupGlobalResults(EMPTY_GLOBAL_RESULTS)).toEqual([])
  })
})
