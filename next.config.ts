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
  `img-src 'self' data: blob: https://randomuser.me ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin}`.trim(),
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
  '/messages',
  '/activity',
  '/jobs',
  '/outreach',
  '/talent',
  '/design-system',
  '/api',
]

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'randomuser.me' },
      // Supabase storage (avatars/covers). Hostname derived from the project URL.
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
