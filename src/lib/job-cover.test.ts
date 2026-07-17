import { describe, it, expect } from 'vitest'
import { resolveCoverUrl } from './job-cover'

const SUPABASE_URL = 'https://demo.supabase.co'
const VALID_COVER = `${SUPABASE_URL}/storage/v1/object/public/covers/seed-assets/job.webp`

describe('resolveCoverUrl', () => {
  it('accepts a public storage object URL on the Supabase origin', () => {
    expect(resolveCoverUrl(VALID_COVER, SUPABASE_URL)).toBe(VALID_COVER)
  })

  it('returns null for missing values', () => {
    expect(resolveCoverUrl(null, SUPABASE_URL)).toBeNull()
    expect(resolveCoverUrl(undefined, SUPABASE_URL)).toBeNull()
    expect(resolveCoverUrl('', SUPABASE_URL)).toBeNull()
  })

  it('rejects unparseable strings instead of letting next/image crash the page', () => {
    expect(resolveCoverUrl('x', SUPABASE_URL)).toBeNull()
    expect(resolveCoverUrl('not a url at all', SUPABASE_URL)).toBeNull()
    expect(resolveCoverUrl('/relative/path.webp', SUPABASE_URL)).toBeNull()
  })

  it('rejects URLs on foreign origins', () => {
    expect(resolveCoverUrl('https://evil.example/cat.webp', SUPABASE_URL)).toBeNull()
    expect(resolveCoverUrl('https://demo.supabase.co.evil.example/storage/v1/object/public/covers/a.webp', SUPABASE_URL)).toBeNull()
    expect(resolveCoverUrl(`http://demo.supabase.co/storage/v1/object/public/covers/a.webp`, SUPABASE_URL)).toBeNull()
  })

  it('rejects Supabase URLs outside public storage objects', () => {
    expect(resolveCoverUrl(`${SUPABASE_URL}/auth/v1/logout`, SUPABASE_URL)).toBeNull()
    expect(resolveCoverUrl(`${SUPABASE_URL}/storage/v1/object/sign/covers/a.webp`, SUPABASE_URL)).toBeNull()
  })

  it('supports the local-dev http origin', () => {
    const local = 'http://127.0.0.1:54321'
    expect(resolveCoverUrl(`${local}/storage/v1/object/public/covers/a.webp`, local))
      .toBe(`${local}/storage/v1/object/public/covers/a.webp`)
  })

  it('returns null when the Supabase URL is not configured', () => {
    expect(resolveCoverUrl(VALID_COVER, undefined)).toBeNull()
    expect(resolveCoverUrl(VALID_COVER, '')).toBeNull()
  })
})
