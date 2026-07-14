import type { SupabaseClient } from '@supabase/supabase-js'

// Demo imagery is mirrored into Supabase storage at seed time so the app
// never hotlinks external hosts. Source images come from deterministic,
// seeded URLs, so re-running the seed produces identical imagery.

export function seededCoverUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1600/600`
}

export function seededPortfolioImageUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1200/800`
}

interface MirrorOptions {
  bucket: 'avatars' | 'covers'
  path: string
  sourceUrl: string
}

// Downloads sourceUrl and stores it in Supabase storage. Returns the public
// storage URL, or null if the download/upload failed (callers fall back to
// the source URL so an offline seed run still completes).
export async function mirrorImageToStorage(
  supabase: SupabaseClient,
  { bucket, path, sourceUrl }: MirrorOptions
): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const body = Buffer.from(await response.arrayBuffer())

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, body, { contentType, upsert: true })
    if (error) throw new Error(error.message)

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  } catch (err) {
    console.warn(`  (image mirror failed for ${sourceUrl}: ${(err as Error).message})`)
    return null
  }
}
