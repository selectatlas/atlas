import { describe, expect, it } from 'vitest'
import { getProfileStories, IMAGE_STORY_DURATION_MS, VIDEO_STORY_DURATION_MS } from './stories'
import type { PortfolioItem } from '@/types'

function makeItem(overrides: Partial<PortfolioItem>): PortfolioItem {
  return {
    id: 'item-1',
    profile_id: 'profile-1',
    type: 'image',
    url: '',
    title: null,
    description: null,
    thumbnail_url: null,
    role: null,
    project_date: null,
    outcome: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('getProfileStories', () => {
  it('turns images with a thumbnail into five-second stories', () => {
    const stories = getProfileStories([
      makeItem({ id: 'a', thumbnail_url: 'https://cdn.example.com/a.webp', title: 'Main stage' }),
    ])
    expect(stories).toEqual([
      {
        id: 'a',
        kind: 'image',
        src: 'https://cdn.example.com/a.webp',
        title: 'Main stage',
        durationMs: IMAGE_STORY_DURATION_MS,
      },
    ])
  })

  it('falls back to the image url when there is no thumbnail', () => {
    const stories = getProfileStories([
      makeItem({ id: 'a', url: 'https://cdn.example.com/full.webp' }),
    ])
    expect(stories[0].src).toBe('https://cdn.example.com/full.webp')
  })

  it('skips images with no usable media', () => {
    expect(getProfileStories([makeItem({ url: '', thumbnail_url: null })])).toEqual([])
  })

  it('turns embeddable videos into muted autoplay stories', () => {
    const stories = getProfileStories([
      makeItem({ id: 'v', type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    ])
    expect(stories).toHaveLength(1)
    expect(stories[0].kind).toBe('video')
    expect(stories[0].durationMs).toBe(VIDEO_STORY_DURATION_MS)
    const src = new URL(stories[0].src)
    expect(src.origin + src.pathname).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(src.searchParams.get('autoplay')).toBe('1')
    expect(src.searchParams.get('mute')).toBe('1')
    expect(src.searchParams.get('playsinline')).toBe('1')
  })

  it('uses Vimeo mute spelling for Vimeo embeds', () => {
    const stories = getProfileStories([
      makeItem({ id: 'v', type: 'video', url: 'https://vimeo.com/123456789' }),
    ])
    const src = new URL(stories[0].src)
    expect(src.searchParams.get('autoplay')).toBe('1')
    expect(src.searchParams.get('muted')).toBe('1')
  })

  it('skips non-embeddable videos and bare links', () => {
    const stories = getProfileStories([
      makeItem({ id: 'v', type: 'video', url: 'https://example.com/reel.mp4' }),
      makeItem({ id: 'l', type: 'link', url: 'https://example.com/press' }),
    ])
    expect(stories).toEqual([])
  })

  it('preserves portfolio order', () => {
    const stories = getProfileStories([
      makeItem({ id: 'first', thumbnail_url: 'https://cdn.example.com/1.webp' }),
      makeItem({ id: 'second', type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' }),
      makeItem({ id: 'third', thumbnail_url: 'https://cdn.example.com/3.webp' }),
    ])
    expect(stories.map(s => s.id)).toEqual(['first', 'second', 'third'])
  })
})
