import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { purgeUserStorage } from './user-deletion'

const USER_ID = '11111111-1111-4111-8111-111111111111'

function makeService(pagesByBucket: Record<string, Array<Array<{ name: string }>>>) {
  const removed: Record<string, string[][]> = {}
  const listCalls: Record<string, Array<{ limit: number; offset?: number }>> = {}

  const service = {
    storage: {
      from: (bucket: string) => ({
        list: vi.fn((prefix: string, options: { limit: number; offset?: number }) => {
          listCalls[bucket] = listCalls[bucket] ?? []
          listCalls[bucket].push(options)
          const pages = pagesByBucket[bucket] ?? []
          return Promise.resolve({ data: pages.shift() ?? [] })
        }),
        remove: vi.fn((paths: string[]) => {
          removed[bucket] = removed[bucket] ?? []
          removed[bucket].push(paths)
          return Promise.resolve({ error: null })
        }),
      }),
    },
  }

  return { service: service as unknown as SupabaseClient, removed, listCalls }
}

describe('purgeUserStorage', () => {
  it('deletes every page of files, not just alternating pages', async () => {
    // Simulates >100 objects: after each remove, the re-list returns the
    // next batch (objects shift down). A moving offset would skip these.
    const page1 = Array.from({ length: 100 }, (_, i) => ({ name: `a${i}.webp` }))
    const page2 = Array.from({ length: 100 }, (_, i) => ({ name: `b${i}.webp` }))
    const page3 = [{ name: 'c0.webp' }]
    const { service, removed, listCalls } = makeService({
      avatars: [page1, page2, page3],
      covers: [],
    })

    await purgeUserStorage(service, USER_ID)

    const deletedNames = (removed.avatars ?? []).flat()
    expect(deletedNames).toHaveLength(201)
    expect(deletedNames).toContain(`${USER_ID}/a0.webp`)
    expect(deletedNames).toContain(`${USER_ID}/b99.webp`)
    expect(deletedNames).toContain(`${USER_ID}/c0.webp`)
    // Every list call must re-read the first page (no moving offset).
    for (const call of listCalls.avatars) {
      expect(call.offset ?? 0).toBe(0)
    }
  })

  it('stops when a bucket is empty and never throws', async () => {
    const { service, removed } = makeService({ avatars: [], covers: [] })
    await expect(purgeUserStorage(service, USER_ID)).resolves.toBeUndefined()
    expect(removed.avatars ?? []).toHaveLength(0)
  })
})
