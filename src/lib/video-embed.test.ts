import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getVideoEmbedUrl, resolveVideoSource } from './video-embed'

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

  it('returns null for sources that are not framable iframes', () => {
    // Both play in-app, but not via an iframe - resolveVideoSource handles them.
    expect(getVideoEmbedUrl('https://cdn.example.com/reel.mp4')).toBeNull()
    expect(getVideoEmbedUrl('https://www.instagram.com/reel/C2Xa1PQrLpS/')).toBeNull()
  })
})

describe('resolveVideoSource', () => {
  // isSelfHosted compares against the configured Supabase origin.
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('maps TikTok canonical URLs to the v2 embed', () => {
    expect(resolveVideoSource('https://www.tiktok.com/@scout2015/video/6718335390845095173')).toEqual({
      kind: 'embed',
      provider: 'tiktok',
      src: 'https://www.tiktok.com/embed/v2/6718335390845095173',
      portrait: true,
    })
  })

  it('accepts a TikTok embed URL that has already been resolved', () => {
    expect(resolveVideoSource('https://www.tiktok.com/embed/v2/6718335390845095173')).toMatchObject({
      provider: 'tiktok',
      src: 'https://www.tiktok.com/embed/v2/6718335390845095173',
    })
  })

  it('rejects vm.tiktok.com short links, which need a network round trip', () => {
    expect(resolveVideoSource('https://vm.tiktok.com/ZMabcdefg/')).toBeNull()
  })

  it('marks Instagram as blocked rather than embeddable', () => {
    // Instagram serves X-Frame-Options: DENY - verified against a real public
    // post. An iframe would render a browser error, so callers must not try.
    for (const path of ['p', 'reel', 'reels', 'tv']) {
      expect(resolveVideoSource(`https://www.instagram.com/${path}/C2Xa1PQrLpS/`)).toEqual({
        kind: 'blocked',
        provider: 'instagram',
      })
    }
  })

  it('does not treat a non-post Instagram URL as a video', () => {
    expect(resolveVideoSource('https://www.instagram.com/someprofile/')).toBeNull()
  })

  it('recognises video files we host ourselves', () => {
    const base = 'https://ref.supabase.co/storage/v1/object/public/portfolio/uid'
    expect(resolveVideoSource(`${base}/a.mp4`)).toEqual({ kind: 'file', src: `${base}/a.mp4` })
    expect(resolveVideoSource(`${base}/a.webm`)).toMatchObject({ kind: 'file' })
    expect(resolveVideoSource(`${base}/a.MOV`)).toMatchObject({ kind: 'file' })
  })

  it('does not offer a player for video files on origins the CSP blocks', () => {
    // media-src allowlists only our own origins, so a third-party .mp4 would
    // mount a <video> the browser then refuses to load. Fall back to a link.
    expect(resolveVideoSource('https://cdn.example.com/showreel.mp4')).toBeNull()
    expect(resolveVideoSource('https://evil.example/clip.mov')).toBeNull()
  })

  it('does not mistake an image or page URL for a video file', () => {
    expect(resolveVideoSource('https://ref.supabase.co/storage/photo.jpg')).toBeNull()
    expect(resolveVideoSource('https://example.com/about')).toBeNull()
  })

  it('still rejects hostile and malformed URLs', () => {
    expect(resolveVideoSource('https://tiktok.com.evil.com/@a/video/6718335390845095173')).toBeNull()
    expect(resolveVideoSource('https://instagram.com.evil.com/reel/abc/')).toBeNull()
    expect(resolveVideoSource('javascript:alert(1)')).toBeNull()
    expect(resolveVideoSource('not a url')).toBeNull()
    expect(resolveVideoSource(null)).toBeNull()
  })
})
