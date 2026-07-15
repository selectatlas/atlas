import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/platform-admin', () => ({
  requirePlatformAdmin: vi.fn(),
}))

import { PATCH } from './route'
import { requirePlatformAdmin } from '@/lib/platform-admin'

const mockRequirePlatformAdmin = requirePlatformAdmin as ReturnType<typeof vi.fn>

const USER_ID = '44444444-4444-4444-8444-444444444444'

function makeService({
  target = { id: USER_ID, account_type: 'talent', email: 'user@test.com' },
  isPlatformAdmin = false,
  updateError = null,
}: {
  target?: { id: string; account_type: string; email: string } | null
  isPlatformAdmin?: boolean
  updateError?: { code: string } | null
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: target, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: updateError ? null : { id: USER_ID, account_type: 'hirer' },
                  error: updateError,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'platform_admins') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: isPlatformAdmin ? { user_id: USER_ID } : null }),
            }),
          }),
        }
      }
      return {}
    }),
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  }
}

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('changes account_type for a user', async () => {
    const service = makeService()
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service,
    })

    const res = await PATCH(
      new Request('http://localhost/api/admin/users/x', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_account_type', account_type: 'hirer' }),
      }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.account_type).toBe('hirer')
    expect(service.auth.admin.updateUserById).toHaveBeenCalledWith(USER_ID, {
      user_metadata: { account_type: 'hirer' },
    })
  })

  it('blocks role changes for platform admins', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service: makeService({ isPlatformAdmin: true }),
    })

    const res = await PATCH(
      new Request('http://localhost/api/admin/users/x', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_account_type', account_type: 'hirer' }),
      }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/platform admin/i)
  })
})
