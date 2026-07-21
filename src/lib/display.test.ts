import { describe, it, expect } from 'vitest'
import { nameInitial, portfolioImageAlt, splitRate } from '@/lib/display'

describe('display helpers', () => {
  it('nameInitial returns a placeholder for empty names', () => {
    expect(nameInitial('')).toBe('?')
    expect(nameInitial('   ')).toBe('?')
    expect(nameInitial(null)).toBe('?')
  })

  it('nameInitial uppercases the first trimmed character', () => {
    expect(nameInitial(' priya')).toBe('P')
  })

  it('portfolioImageAlt falls back by media type', () => {
    expect(portfolioImageAlt({ type: 'video', title: null })).toBe('Portfolio video')
    expect(portfolioImageAlt({ type: 'image', title: '  ' })).toBe('Portfolio image')
    expect(portfolioImageAlt({ type: 'link', title: null, description: 'Behind the scenes' })).toBe('Behind the scenes')
  })

  it('splitRate separates the amount from its unit', () => {
    expect(splitRate('£300 per day')).toEqual({ amount: '£300', unit: 'per day' })
    expect(splitRate('$1,250 per week')).toEqual({ amount: '$1,250', unit: 'per week' })
  })

  it('splitRate keeps only the first of several rates', () => {
    expect(splitRate('£300 per day / £180 half day')).toEqual({
      amount: '£300',
      unit: 'per day',
    })
  })

  it('splitRate handles a bare amount and missing input', () => {
    expect(splitRate('£400')).toEqual({ amount: '£400', unit: null })
    expect(splitRate('Rate on request')).toEqual({ amount: 'Rate on request', unit: null })
    expect(splitRate(null)).toBeNull()
    expect(splitRate('  ')).toBeNull()
  })
})
