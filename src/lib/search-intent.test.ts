import { describe, expect, it } from 'vitest'
import type { ParsedQuery } from '@/lib/openai'
import { parsedIntentChips } from './search-intent'

const emptyParse: ParsedQuery = {
  category: null,
  skills: [],
  location: null,
  availability: null,
  languages: [],
  gender: [],
  age_min: null,
  age_max: null,
  spact: null,
}

describe('parsedIntentChips', () => {
  it('returns no chips for an all-null parse', () => {
    expect(parsedIntentChips(emptyParse)).toEqual([])
  })

  it('formats a full parse with underscore-free labels', () => {
    expect(parsedIntentChips({
      category: 'photographer_videographer',
      skills: ['Bollywood', 'Kathak'],
      location: 'London',
      availability: 'December',
      languages: ['Hindi'],
      gender: ['non_binary'],
      age_min: 25,
      age_max: 35,
      spact: true,
    })).toEqual([
      'photographer videographer',
      'Bollywood',
      'Kathak',
      'London',
      'Available: December',
      'Hindi',
      'non binary',
      'Age 25-35',
      'SPACT',
    ])
  })

  it('formats an open-ended minimum age', () => {
    expect(parsedIntentChips({ ...emptyParse, age_min: 25 })).toEqual(['Age 25+'])
  })

  it('formats an open-ended maximum age', () => {
    expect(parsedIntentChips({ ...emptyParse, age_max: 35 })).toEqual(['Age up to 35'])
  })

  it('produces no SPACT chip for false or null', () => {
    expect(parsedIntentChips({ ...emptyParse, spact: false })).toEqual([])
    expect(parsedIntentChips({ ...emptyParse, spact: null })).toEqual([])
  })
})
