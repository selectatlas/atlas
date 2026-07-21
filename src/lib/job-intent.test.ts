import { describe, expect, it } from 'vitest'
import {
  isEmptyJobIntent,
  stripQueryFiller,
  jobIntentChips,
  jobIntentToFilters,
  jobSearchTerm,
  rateRangeToBand,
} from './job-intent'
import type { ParsedJobQuery } from './openai'

function parsed(overrides: Partial<ParsedJobQuery> = {}): ParsedJobQuery {
  return {
    category: null, role: null, location: null, work_type: null,
    availability: null, rate_min: null, rate_max: null, keywords: [],
    ...overrides,
  }
}

describe('rateRangeToBand', () => {
  it('returns any when no rate was mentioned', () => {
    expect(rateRangeToBand(null, null)).toBe('any')
  })

  it('maps a floor at or above 500 to the top band', () => {
    expect(rateRangeToBand(500, null)).toBe('over500')
    expect(rateRangeToBand(750, null)).toBe('over500')
  })

  it('maps a ceiling at or below 250 to the bottom band', () => {
    expect(rateRangeToBand(null, 250)).toBe('under250')
    expect(rateRangeToBand(null, 100)).toBe('under250')
  })

  it('maps a range inside 250-500 to the middle band', () => {
    expect(rateRangeToBand(300, 450)).toBe('250to500')
    expect(rateRangeToBand(250, 500)).toBe('250to500')
  })

  it('stays any when the range straddles a band boundary', () => {
    // Snapping these would silently hide valid jobs on the far side.
    expect(rateRangeToBand(200, 400)).toBe('any')
    expect(rateRangeToBand(400, 800)).toBe('any')
    expect(rateRangeToBand(100, 900)).toBe('any')
  })

  it('treats an open-ended floor below 500 as unconstrained', () => {
    // "over £300" is unbounded above, so it spans 250-500 AND >500. Snapping
    // it to the middle band would hide every job paying more than was asked
    // for - caught by running a real query against the live route.
    expect(rateRangeToBand(300, null)).toBe('any')
    expect(rateRangeToBand(100, null)).toBe('any')
    expect(rateRangeToBand(499, null)).toBe('any')
  })

  it('treats an open-ended ceiling above 250 as unconstrained', () => {
    expect(rateRangeToBand(null, 400)).toBe('any')
    expect(rateRangeToBand(null, 900)).toBe('any')
  })
})

describe('stripQueryFiller', () => {
  it('removes search-intent words a posting never contains', () => {
    expect(stripQueryFiller('dance jobs')).toBe('dance')
    expect(stripQueryFiller('acting roles')).toBe('acting')
    expect(stripQueryFiller('dancer wanted')).toBe('dancer')
  })

  it('is case-insensitive', () => {
    expect(stripQueryFiller('Dance JOBS')).toBe('Dance')
  })

  it('keeps words that describe the work itself', () => {
    expect(stripQueryFiller('bollywood dancer london')).toBe('bollywood dancer london')
  })

  it('can empty the term entirely rather than leave an unmatchable word', () => {
    // Better to fall back to filters than to AND against a word no posting has.
    expect(stripQueryFiller('jobs available near me')).toBe('')
  })
})

describe('jobSearchTerm', () => {
  it('strips filler that would zero an AND-semantics full-text query', () => {
    expect(jobSearchTerm(parsed({ keywords: ['dance jobs'], location: 'London' })))
      .toBe('London dance')
  })

  it('combines the role and leftover keywords', () => {
    expect(jobSearchTerm(parsed({ role: 'backing dancer', keywords: ['music video'] })))
      .toBe('backing dancer music video')
  })

  it('keeps location in the term - the structured filter is exact-match', () => {
    // Postings store "London, UK"; the parser yields "London". Exact matching
    // finds 1 job where full-text finds 7, so location must be searched.
    expect(jobSearchTerm(parsed({ role: 'dancer', location: 'London' }))).toBe('dancer London')
  })

  it('drops rate from the term - it maps cleanly onto a structured filter', () => {
    expect(jobSearchTerm(parsed({ role: 'dancer', rate_min: 300 }))).toBe('dancer')
  })

  it('returns an empty string when there is nothing to rank on', () => {
    expect(jobSearchTerm(parsed({ rate_min: 300 }))).toBe('')
  })

  it('ignores blank and whitespace-only keywords', () => {
    expect(jobSearchTerm(parsed({ role: 'actor', keywords: ['', '   '] }))).toBe('actor')
  })
})

describe('jobIntentToFilters', () => {
  it('maps a full natural-language query onto discover filters', () => {
    const filters = jobIntentToFilters(parsed({
      category: 'dancer',
      role: 'backing dancer',
      location: 'London',
      work_type: 'in_person',
      rate_min: 500,
    }))
    expect(filters.categories).toEqual(['dancer'])
    expect(filters.search).toBe('backing dancer London')
    // Never the exact-match filter - a parsed location goes through FTS.
    expect(filters.location).toBeNull()
    expect(filters.workType).toBe('in_person')
    expect(filters.budgetBand).toBe('over500')
  })

  it('sorts by relevance only when there is a term to rank against', () => {
    expect(jobIntentToFilters(parsed({ role: 'dancer' })).sort).toBe('relevance')
    expect(jobIntentToFilters(parsed({ location: 'London' })).sort).toBe('relevance')
    expect(jobIntentToFilters(parsed({ rate_min: 600 })).sort).toBe('newest')
  })

  it('drops a category the taxonomy does not know', () => {
    expect(jobIntentToFilters(parsed({ category: 'astronaut' })).categories).toEqual([])
  })

  it('drops an unknown work type rather than passing it to the query', () => {
    expect(jobIntentToFilters(parsed({ work_type: 'hologram' })).workType).toBe('all')
  })

  it('caps an absurdly long location inside the search term', () => {
    const filters = jobIntentToFilters(parsed({ location: 'x'.repeat(500) }))
    expect(filters.location).toBeNull()
    // sanitizeSearchTerm caps the term at 100 characters.
    expect(filters.search.length).toBe(100)
  })
})

describe('isEmptyJobIntent', () => {
  it('is true when the parser found nothing', () => {
    expect(isEmptyJobIntent(parsed())).toBe(true)
  })

  it('is false when any structured field survived', () => {
    expect(isEmptyJobIntent(parsed({ location: 'London' }))).toBe(false)
    expect(isEmptyJobIntent(parsed({ category: 'dancer' }))).toBe(false)
    expect(isEmptyJobIntent(parsed({ role: 'dancer' }))).toBe(false)
    expect(isEmptyJobIntent(parsed({ availability: 'December' }))).toBe(false)
    expect(isEmptyJobIntent(parsed({ rate_min: 600 }))).toBe(false)
  })

  it('is true when only an unusable category survived', () => {
    expect(isEmptyJobIntent(parsed({ category: 'astronaut' }))).toBe(true)
  })
})

describe('jobIntentChips', () => {
  it('describes what the parser understood', () => {
    const chips = jobIntentChips(parsed({
      category: 'dancer', location: 'London', availability: 'December', rate_min: 500,
    }))
    expect(chips).toContain('London')
    expect(chips).toContain('December')
    expect(chips).toContain('Over £500/day')
  })

  it('labels each budget band in plain language', () => {
    expect(jobIntentChips(parsed({ rate_max: 200 }))).toContain('Under £250/day')
    expect(jobIntentChips(parsed({ rate_min: 300, rate_max: 400 }))).toContain('£250-500/day')
  })

  it('omits a straddling rate range rather than mislabelling it', () => {
    expect(jobIntentChips(parsed({ rate_min: 200, rate_max: 400 }))).toEqual([])
  })

  it('returns nothing for an empty parse', () => {
    expect(jobIntentChips(parsed())).toEqual([])
  })

  it('caps the chip count', () => {
    const chips = jobIntentChips(parsed({
      category: 'dancer', role: 'backing dancer', location: 'London',
      work_type: 'in_person', availability: 'December', rate_min: 500,
    }))
    expect(chips.length).toBeLessThanOrEqual(6)
  })
})
