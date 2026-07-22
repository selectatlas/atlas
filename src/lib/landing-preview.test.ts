import { describe, expect, it } from 'vitest'
import { findLandingPreviewMatches, type LandingPreviewCandidate } from './landing-preview'

const candidates: LandingPreviewCandidate[] = [
  {
    name: 'Priya Singh',
    category: 'Dancer',
    role: 'Bollywood & Kathak dancer',
    city: 'London',
    availability: 'Available Dec & Jan',
    skills: ['Bollywood', 'Kathak', 'Hindi speaker'],
  },
  {
    name: 'James Morrison',
    category: 'Actor',
    role: 'Screen actor · stage combat',
    city: 'London',
    availability: 'Available now',
    skills: ['Film acting', 'Stage combat', 'Boxing'],
  },
  {
    name: 'Sophie Clarke',
    category: 'Creator',
    role: 'Food content creator',
    city: 'London',
    availability: 'Available December',
    skills: ['Food content', 'Short-form video', 'Brand partnerships'],
  },
]

describe('findLandingPreviewMatches', () => {
  it('ranks the Bollywood and Hindi-speaking dancer first', () => {
    const matches = findLandingPreviewMatches('Bollywood dancer in London who speaks Hindi, available in December', candidates)

    expect(matches[0]?.talent.name).toBe('Priya Singh')
    expect(matches[0]?.reasons).toContain('Bollywood')
  })

  it('ranks the actor with stage combat and boxing first', () => {
    const matches = findLandingPreviewMatches('Actor with real stage combat and boxing training', candidates)

    expect(matches[0]?.talent.name).toBe('James Morrison')
    expect(matches[0]?.reasons).toContain('Stage combat')
  })

  it('normalises short-form searches', () => {
    const matches = findLandingPreviewMatches('Food creator for short form video', candidates)

    expect(matches[0]?.talent.name).toBe('Sophie Clarke')
  })

  it('returns no fabricated result for an unrelated query', () => {
    expect(findLandingPreviewMatches('underwater violinist in Oslo', candidates)).toEqual([])
  })

  it('does not treat creator as an actor substring match', () => {
    expect(findLandingPreviewMatches('actor', [candidates[2]])).toEqual([])
  })

  it('returns no result for an empty query', () => {
    expect(findLandingPreviewMatches('   ', candidates)).toEqual([])
  })
})
