/**
 * Resolve a portfolio video URL into something we can play *inside* Atlas.
 *
 * Three outcomes, because the platforms genuinely differ:
 *  - `embed`   an iframe we are allowed to frame (YouTube, Vimeo, TikTok).
 *              Every host here must also appear in `frame-src` in
 *              next.config.ts, or the CSP silently blanks the player.
 *  - `file`    a direct video file (our own uploads, or a pasted .mp4). Played
 *              with a native <video>, which needs the host in `media-src`.
 *  - `blocked` a platform that refuses to be framed at all. Instagram sends
 *              `X-Frame-Options: DENY` on its embed endpoint, so no CSP change
 *              on our side can make it work - the browser refuses on their
 *              instruction. Callers surface an upload prompt instead of an
 *              iframe that would render a "refused to connect" box.
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'tiktok'

export type VideoSource =
  | { kind: 'embed'; provider: VideoProvider; src: string; portrait: boolean }
  | { kind: 'file'; src: string }
  | { kind: 'blocked'; provider: 'instagram' }

const VIDEO_FILE_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v']

function parse(url: string | null | undefined): URL | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  // Blocks javascript:, data:, and anything else that is not a web fetch.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  return parsed
}

// YouTube video IDs are exactly 11 URL-safe characters. Anything else (e.g.
// seeded placeholder URLs) falls back to a link card instead of a dead iframe.
function isVideoId(id: string | null | undefined): id is string {
  return !!id && /^[\w-]{11}$/.test(id)
}

export function resolveVideoSource(url: string | null | undefined): VideoSource | null {
  const parsed = parse(url)
  if (!parsed) return null

  const host = parsed.hostname.replace(/^www\./, '')

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v')
      return isVideoId(id) ? youtube(id) : null
    }
    const shortsOrEmbed = parsed.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)
    return shortsOrEmbed ? youtube(shortsOrEmbed[1]!) : null
  }

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1)
    return isVideoId(id) ? youtube(id) : null
  }

  if (host === 'vimeo.com') {
    const match = parsed.pathname.match(/^\/(\d{6,12})(?:\/|$)/)
    return match ? vimeo(match[1]!) : null
  }

  if (host === 'player.vimeo.com') {
    const match = parsed.pathname.match(/^\/video\/(\d{6,12})(?:\/|$)/)
    return match ? vimeo(match[1]!) : null
  }

  // TikTok IDs are 19-digit snowflakes. Both the canonical profile URL and the
  // bare embed URL are accepted; vm.tiktok.com short links are not, because
  // resolving them needs a network round trip we will not do at render time.
  if (host === 'tiktok.com' || host === 'm.tiktok.com') {
    const canonical = parsed.pathname.match(/^\/@[^/]+\/video\/(\d{6,25})(?:\/|$)/)
    if (canonical) return tiktok(canonical[1]!)
    const embed = parsed.pathname.match(/^\/embed\/(?:v2\/)?(\d{6,25})(?:\/|$)/)
    if (embed) return tiktok(embed[1]!)
    return null
  }

  // Instagram refuses framing outright - see the module comment.
  if (host === 'instagram.com') {
    return /^\/(?:p|reel|reels|tv)\/[\w-]+/.test(parsed.pathname)
      ? { kind: 'blocked', provider: 'instagram' }
      : null
  }

  // A direct video file. Restricted to media we host, because `media-src` in
  // the CSP allowlists only our own origins - a .mp4 on someone else's CDN
  // would mount a <video> the browser then refuses to load, which reads as a
  // broken player. Those fall through to the link card instead.
  const path = parsed.pathname.toLowerCase()
  if (VIDEO_FILE_EXTENSIONS.some(extension => path.endsWith(extension)) && isSelfHosted(parsed)) {
    return { kind: 'file', src: parsed.toString() }
  }

  return null
}

// Mirrors `media-src 'self' blob: data: <supabase>` in next.config.ts.
function isSelfHosted(url: URL): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      if (url.origin === new URL(supabaseUrl).origin) return true
    } catch {
      // Malformed env var - fall through to the same-origin check.
    }
  }
  if (typeof window !== 'undefined' && url.origin === window.location.origin) return true
  return false
}

function youtube(id: string): VideoSource {
  return {
    kind: 'embed',
    provider: 'youtube',
    src: `https://www.youtube-nocookie.com/embed/${id}`,
    portrait: false,
  }
}

function vimeo(id: string): VideoSource {
  return {
    kind: 'embed',
    provider: 'vimeo',
    src: `https://player.vimeo.com/video/${id}`,
    portrait: false,
  }
}

function tiktok(id: string): VideoSource {
  return {
    kind: 'embed',
    provider: 'tiktok',
    src: `https://www.tiktok.com/embed/v2/${id}`,
    // TikTok's player is portrait; forcing it into 16:9 letterboxes it badly.
    portrait: true,
  }
}

/**
 * Back-compat helper for callers that only ever wanted an iframe src
 * (inline showreel, story rails). Returns null for files and blocked hosts.
 */
export function getVideoEmbedUrl(url: string | null | undefined): string | null {
  const source = resolveVideoSource(url)
  return source?.kind === 'embed' ? source.src : null
}
