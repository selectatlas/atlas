// jobs.cover_url is written through the app, but RLS (jobs_manage_own) lets a
// hirer set the column to any string from the browser console — and
// jobs_select_all then serves that string to every talent. An unparseable
// value would crash next/image ("Failed to parse src") for everyone whose
// Discover feed includes the job, and a foreign URL would render a broken
// image (only the Supabase storage host is in next.config remotePatterns).
// So treat cover_url as untrusted: only public Supabase storage object URLs
// are renderable; anything else falls back to the category gradient.

const PUBLIC_STORAGE_PATH = '/storage/v1/object/public/'

export function resolveCoverUrl(
  coverUrl: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!coverUrl || !supabaseUrl) return null

  let cover: URL
  let allowed: URL
  try {
    cover = new URL(coverUrl)
    allowed = new URL(supabaseUrl)
  } catch {
    return null
  }

  if (cover.origin !== allowed.origin) return null
  if (!cover.pathname.startsWith(PUBLIC_STORAGE_PATH)) return null
  return coverUrl
}
