/**
 * Map a YouTube or Vimeo URL to an embeddable iframe src.
 * Returns null for anything else — callers fall back to a plain link.
 */
export function getVideoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null

  const host = parsed.hostname.replace(/^www\./, '')

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v')
      return isVideoId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    const shortsOrEmbed = parsed.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)
    return shortsOrEmbed ? `https://www.youtube-nocookie.com/embed/${shortsOrEmbed[1]}` : null
  }

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1)
    return isVideoId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }

  if (host === 'vimeo.com') {
    const match = parsed.pathname.match(/^\/(\d{6,12})(?:\/|$)/)
    return match ? `https://player.vimeo.com/video/${match[1]}` : null
  }

  if (host === 'player.vimeo.com') {
    const match = parsed.pathname.match(/^\/video\/(\d{6,12})(?:\/|$)/)
    return match ? `https://player.vimeo.com/video/${match[1]}` : null
  }

  return null
}

// YouTube video IDs are exactly 11 URL-safe characters. Anything else (e.g.
// seeded placeholder URLs) falls back to a link card instead of a dead iframe.
function isVideoId(id: string | null): id is string {
  return !!id && /^[\w-]{11}$/.test(id)
}
