import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('retired service worker', () => {
  const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

  it('cannot intercept or cache authenticated pages', () => {
    expect(source).not.toMatch(/addEventListener\(['"]fetch['"]/)
    expect(source).not.toContain('cache.put')
  })

  it('clears the legacy page cache and unregisters itself', () => {
    expect(source).toContain("caches.delete(RETIRED_CACHE_NAME)")
    expect(source).toContain('self.registration.unregister()')
  })
})
