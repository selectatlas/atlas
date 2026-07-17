import type { PortfolioItem } from '@/types'
import { getVideoEmbedUrl } from './video-embed'

export const IMAGE_STORY_DURATION_MS = 5000
export const VIDEO_STORY_DURATION_MS = 15000

export interface ProfileStory {
  id: string
  kind: 'image' | 'video'
  src: string
  title: string | null
  durationMs: number
}

/**
 * Derive Instagram-style profile stories from a talent's portfolio.
 * Images become five-second frames; embeddable videos autoplay muted for a
 * fixed window (embeds can't report playback progress cross-origin). Items
 * with no usable media — bare links, videos we can't embed, images without a
 * URL — are skipped so the viewer never shows a dead frame.
 */
export function getProfileStories(items: PortfolioItem[]): ProfileStory[] {
  const stories: ProfileStory[] = []

  for (const item of items) {
    if (item.type === 'image') {
      const src = item.thumbnail_url || item.url
      if (src) {
        stories.push({
          id: item.id,
          kind: 'image',
          src,
          title: item.title,
          durationMs: IMAGE_STORY_DURATION_MS,
        })
      }
    } else if (item.type === 'video') {
      const embedUrl = getVideoEmbedUrl(item.url)
      if (embedUrl) {
        stories.push({
          id: item.id,
          kind: 'video',
          src: withAutoplay(embedUrl),
          title: item.title,
          durationMs: VIDEO_STORY_DURATION_MS,
        })
      }
    }
  }

  return stories
}

// Stories should start playing the moment they appear, muted so mobile
// browsers allow it. YouTube and Vimeo spell the params differently.
function withAutoplay(embedUrl: string): string {
  const url = new URL(embedUrl)
  url.searchParams.set('autoplay', '1')
  if (url.hostname === 'player.vimeo.com') {
    url.searchParams.set('muted', '1')
  } else {
    url.searchParams.set('mute', '1')
    url.searchParams.set('playsinline', '1')
  }
  return url.toString()
}
