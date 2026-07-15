import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { getAdminAllowlist, getPlatformAdminRole, ensurePlatformAdmin, requirePlatformAdmin } from '@/lib/platform-admin'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>

describe('getAdminAllowlist', () => {
  it('parses comma-separated emails case-insensitively', () => {
    vi.stubEnv('ATLAS_ADMIN_EMAILS', 'Owner@Atlas.io, mod@atlas.io')
    expect(getAdminAllowlist()).toEqual(new Set(['owner@atlas.io', 'mod@atlas.io']))
    vi.unstubAllEnvs()
  })
})

describe('requirePlatformAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const result = await requirePlatformAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('returns 403 when user is not an admin', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'user@test.com' } } }) },
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
        upsert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      })),
    })

    const result = await requirePlatformAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it('bootstraps allowlisted email and grants access', async () => {
    vi.stubEnv('ATLAS_ADMIN_EMAILS', 'owner@atlas.io')
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'owner@atlas.io' } } }) },
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
        upsert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { role: 'owner' }, error: null }),
          }),
        }),
      })),
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    })

    const result = await requirePlatformAdmin()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe('u1')
      expect(result.role).toBe('owner')
    }
  })
})

describe('getPlatformAdminRole', () => {
  it('returns null for unknown roles', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { role: 'superuser' } }),
          }),
        }),
      })),
    })

    await expect(getPlatformAdminRole('u1')).resolves.toBeNull()
  })
})

describe('ensurePlatformAdmin', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns existing role without upserting', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { role: 'moderator' } }),
          }),
        }),
      })),
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    })

    await expect(ensurePlatformAdmin('u1', 'any@test.com')).resolves.toBe('moderator')
  })
})
