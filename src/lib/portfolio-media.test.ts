import { describe, it, expect } from 'vitest'
import { storagePathFromUrl } from './portfolio-media'

const UID = '11111111-1111-4111-8111-111111111111'
const BASE = `https://abc123.supabase.co/storage/v1/object/public/portfolio/${UID}`

describe('storagePathFromUrl', () => {
  it('extracts the storage path from an uploaded portfolio image URL', () => {
    expect(storagePathFromUrl(`${BASE}/photo.png`)).toBe(`${UID}/photo.png`)
  })

  it('ignores query strings and fragments', () => {
    expect(storagePathFromUrl(`${BASE}/photo.webp?width=400`)).toBe(`${UID}/photo.webp`)
    expect(storagePathFromUrl(`${BASE}/photo.jpg#top`)).toBe(`${UID}/photo.jpg`)
  })

  // Deleting a portfolio row must never try to delete someone else's hosting.
  it('returns null for external URLs', () => {
    expect(storagePathFromUrl('https://youtube.com/watch?v=abc')).toBeNull()
    expect(storagePathFromUrl('https://vimeo.com/123456')).toBeNull()
    expect(storagePathFromUrl('https://example.com/portfolio/photo.png')).toBeNull()
  })

  it('returns null for other buckets', () => {
    expect(
      storagePathFromUrl(`https://abc123.supabase.co/storage/v1/object/public/avatars/${UID}/a.png`),
    ).toBeNull()
  })

  it('returns null when the owner segment is not a uuid', () => {
    expect(
      storagePathFromUrl('https://abc123.supabase.co/storage/v1/object/public/portfolio/etc/passwd'),
    ).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(storagePathFromUrl(undefined as unknown as string)).toBeNull()
  })
})
