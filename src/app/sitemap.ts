import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { createAnonClient } from '@/lib/supabase/server'

// Metadata routes are statically cached by default; without this the job
// entries would be frozen at build time until the next deploy.
export const revalidate = 3600

// Only genuinely public pages belong here.
const STATIC_ENTRIES: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
  { url: `${SITE_URL}/jobs`, changeFrequency: 'hourly', priority: 0.9 },
  { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/signup`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The sitemap must never 500: on any query failure, fall back to the
  // static entries so crawlers keep a valid file.
  try {
    const supabase = createAnonClient()
    const { data } = await supabase
      .from('public_open_jobs')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    const jobEntries: MetadataRoute.Sitemap = (data ?? []).map(job => ({
      url: `${SITE_URL}/jobs/${job.id}`,
      lastModified: new Date(job.created_at),
      changeFrequency: 'daily',
      priority: 0.7,
    }))

    return [...STATIC_ENTRIES, ...jobEntries]
  } catch {
    return STATIC_ENTRIES
  }
}
