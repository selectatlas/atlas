import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated and internal surfaces (mirrors X-Robots-Tag headers)
        disallow: [
          '/search',
          '/discover',
          '/profile',
          '/messages',
          '/activity',
          '/jobs',
          '/outreach',
          '/talent/',
          '/design-system',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
