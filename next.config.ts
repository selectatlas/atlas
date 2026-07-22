import type { NextConfig } from 'next'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

// Supabase origin is baked into headers at build time - keep the CSP
// allowlist narrow: exactly the origins the app actually calls.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseOrigin = supabaseUrl.replace(/\/$/, '')
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, 'ws')

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js requires inline scripts for hydration; dev additionally needs eval.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin}`.trim(),
  // Portfolio video. Without these two, frame-src and media-src fall back to
  // default-src 'self' and every player is silently blanked by the CSP.
  // Keep in lockstep with the providers in src/lib/video-embed.ts. Instagram
  // is deliberately absent: it sends X-Frame-Options: DENY, so allowlisting it
  // would not help - that path prompts for a file upload instead.
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://www.tiktok.com",
  // blob: covers the local preview shown while an upload is still in flight.
  `media-src 'self' blob: data: ${supabaseOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS only outside development; browsers ignore it over plain http anyway.
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }]),
]

// Authenticated and internal surfaces must never be indexed.
const NOINDEX_PATHS = [
  '/search',
  '/discover',
  '/profile',
  '/settings',
  '/messages',
  '/home',
  '/activity',
  '/my-jobs',
  '/shortlists',
  '/outreach',
  '/talent',
  '/design-system',
  '/api',
]

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // PostHog endpoints require trailing slashes; the /ingest reverse proxy
  // lives in src/proxy.ts (it must run before auth and strip cookies).
  skipTrailingSlashRedirect: true,
  images: {
    // Hero tiles and other static assets never change in place; keep
    // optimized variants cached instead of re-transforming per visit.
    minimumCacheTTL: 2678400,
    // 70 is the talent-card carousel's explicit quality (smaller payload for
    // grids of 48 cards); 75 is next/image's own default for everything else.
    qualities: [70, 75],
    remotePatterns: [
      // Supabase storage (avatars/covers/portfolio). Hostname derived from the project URL.
      ...(supabaseOrigin.startsWith('https://')
        ? [{ protocol: 'https' as const, hostname: new URL(supabaseOrigin).hostname }]
        : []),
    ],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      ...NOINDEX_PATHS.map(prefix => ({
        source: `${prefix}/:path*`,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      ...NOINDEX_PATHS.map(prefix => ({
        source: prefix,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ]
  },
}

export default nextConfig
