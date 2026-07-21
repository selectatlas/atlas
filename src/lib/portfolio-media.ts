// Portfolio items hold either a file we uploaded to the `portfolio` storage
// bucket or an external URL the talent pasted. Deleting an item should clean
// up the former and never touch the latter.

// Supabase public object URLs look like:
//   https://<ref>.supabase.co/storage/v1/object/public/portfolio/<uid>/<uuid>.png
// Returns the "<uid>/<file>" storage path, or null for anything we did not
// upload (a YouTube link, a hand-typed URL, a different bucket).
export function storagePathFromUrl(url: string): string | null {
  if (typeof url !== 'string') return null
  const match = url.match(
    /\/storage\/v1\/object\/public\/portfolio\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/?#]+)(?:[?#]|$)/i,
  )
  return match ? match[1] : null
}
