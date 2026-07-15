import { describe, it, expect } from 'vitest'
import { nameInitial, portfolioImageAlt } from '@/lib/display'

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
})
