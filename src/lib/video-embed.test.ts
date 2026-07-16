import { describe, expect, it } from 'vitest'
import { getVideoEmbedUrl } from './video-embed'

describe('getVideoEmbedUrl', () => {
  it('maps YouTube watch URLs to the nocookie embed', () => {
    expect(getVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    )
  })

  it('maps youtu.be short links', () => {
    expect(getVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    )
  })

  it('maps YouTube shorts', () => {
    expect(getVideoEmbedUrl('https://www.youtube.com/shorts/abc123XYZ_-')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123XYZ_-'
    )
  })

  it('maps Vimeo URLs to the player embed', () => {
    expect(getVideoEmbedUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789'
    )
    expect(getVideoEmbedUrl('https://player.vimeo.com/video/123456789')).toBe(
      'https://player.vimeo.com/video/123456789'
    )
  })

  it('rejects everything else', () => {
    expect(getVideoEmbedUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(getVideoEmbedUrl('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(getVideoEmbedUrl('javascript:alert(1)')).toBeNull()
    expect(getVideoEmbedUrl('not a url')).toBeNull()
    expect(getVideoEmbedUrl(null)).toBeNull()
    expect(getVideoEmbedUrl('')).toBeNull()
  })

  it('rejects placeholder IDs that are not exactly 11 characters', () => {
    expect(getVideoEmbedUrl('https://www.youtube.com/watch?v=atlasdemo-priya-reel')).toBeNull()
    expect(getVideoEmbedUrl('https://vimeo.com/atlasdemo/priya-kathak')).toBeNull()
    expect(getVideoEmbedUrl('https://youtu.be/short')).toBeNull()
  })
})
