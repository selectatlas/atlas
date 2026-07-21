import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/platform-admin', () => ({
  requirePlatformAdmin: vi.fn(),
  grantPlatformAdmin: vi.fn(),
  revokePlatformAdmin: vi.fn(),
  countPlatformAdmins: vi.fn(),
}))

vi.mock('@/lib/user-deletion', () => ({
  deleteAuthUser: vi.fn(),
}))

import { PATCH, DELETE } from './route'
import {
  requirePlatformAdmin,
  grantPlatformAdmin,
  revokePlatformAdmin,
  countPlatformAdmins,
} from '@/lib/platform-admin'
import { deleteAuthUser } from '@/lib/user-deletion'

const mockRequirePlatformAdmin = requirePlatformAdmin as ReturnType<typeof vi.fn>
const mockGrantPlatformAdmin = grantPlatformAdmin as ReturnType<typeof vi.fn>
const mockRevokePlatformAdmin = revokePlatformAdmin as ReturnType<typeof vi.fn>
const mockCountPlatformAdmins = countPlatformAdmins as ReturnType<typeof vi.fn>
const mockDeleteAuthUser = deleteAuthUser as ReturnType<typeof vi.fn>

const USER_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_ADMIN_ID = '55555555-5555-4555-8555-555555555555'

function makeService({
  target = { id: USER_ID, account_type: 'talent', email: 'user@test.com' },
  adminRow = null as { user_id: string; role: string } | null,
  updateError = null,
}: {
  target?: { id: string; account_type: string; email: string } | null
  adminRow?: { user_id: string; role: string } | null
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
              maybeSingle: () => Promise.resolve({ data: adminRow, error: null }),
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockGrantPlatformAdmin.mockResolvedValue(true)
    mockRevokePlatformAdmin.mockResolvedValue(true)
    mockCountPlatformAdmins.mockResolvedValue(2)
    mockDeleteAuthUser.mockResolvedValue({ ok: true })
  })

  it('changes account_type for a non-admin user', async () => {
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
        body: JSON.stringify({ action: 'set_role', role: 'hirer' }),
      }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.display_role).toBe('hirer')
    expect(service.auth.admin.updateUserById).toHaveBeenCalledWith(USER_ID, {
      user_metadata: { account_type: 'hirer' },
    })
  })

  it('promotes a user to platform admin', async () => {
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
        body: JSON.stringify({ action: 'set_role', role: 'admin' }),
      }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    expect(mockGrantPlatformAdmin).toHaveBeenCalledWith(service, USER_ID, 'owner')
    const body = await res.json()
    expect(body.profile.display_role).toBe('admin')
  })

  it('demotes a platform admin to hirer', async () => {
    const service = makeService({ adminRow: { user_id: USER_ID, role: 'owner' } })
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: OTHER_ADMIN_ID,
      role: 'owner',
      service,
    })

    const res = await PATCH(
      new Request('http://localhost/api/admin/users/x', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_role', role: 'hirer' }),
      }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    expect(mockRevokePlatformAdmin).toHaveBeenCalledWith(service, USER_ID)
  })

  it('blocks self-demotion from admin', async () => {
    const service = makeService({ adminRow: { user_id: USER_ID, role: 'owner' } })
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: USER_ID,
      role: 'owner',
      service,
    })

    const res = await PATCH(
      new Request('http://localhost/api/admin/users/x', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_role', role: 'hirer' }),
      }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/your own admin access/i)
  })

  it('blocks non-owners from granting admin', async () => {
    const service = makeService()
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'mod-1',
      role: 'moderator',
      service,
    })

    const res = await PATCH(
      new Request('http://localhost/api/admin/users/x', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_role', role: 'admin' }),
      }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/users/[id] set_verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeVerificationService(target: { id: string; account_type: string; email: string } | null) {
    const updateCalls: Array<Record<string, unknown>> = []
    const service = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: target, error: null }),
              }),
            }),
            update: (patch: Record<string, unknown>) => {
              updateCalls.push(patch)
              return {
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve({
                      data: { id: USER_ID, verified_at: patch.verified_at, verified_categories: patch.verified_categories },
                      error: null,
                    }),
                  }),
                }),
              }
            },
          }
        }
        if (table === 'platform_admins') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    return { service, updateCalls }
  }

  function patchRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/admin/users/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('verifies a talent profile with categories', async () => {
    const { service, updateCalls } = makeVerificationService({ id: USER_ID, account_type: 'talent', email: 'user@test.com' })
    mockRequirePlatformAdmin.mockResolvedValue({ ok: true, userId: 'admin-1', role: 'owner', service })

    const res = await PATCH(
      patchRequest({ action: 'set_verification', verified: true, categories: ['dancer', 'actor'] }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].verified_categories).toEqual(['dancer', 'actor'])
    expect(updateCalls[0].verified_at).toBeTruthy()
  })

  it('removes verification and clears categories', async () => {
    const { service, updateCalls } = makeVerificationService({ id: USER_ID, account_type: 'talent', email: 'user@test.com' })
    mockRequirePlatformAdmin.mockResolvedValue({ ok: true, userId: 'admin-1', role: 'owner', service })

    const res = await PATCH(
      patchRequest({ action: 'set_verification', verified: false }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    expect(updateCalls[0]).toEqual({ verified_at: null, verified_categories: [] })
  })

  it('rejects verifying a hirer', async () => {
    const { service, updateCalls } = makeVerificationService({ id: USER_ID, account_type: 'hirer', email: 'user@test.com' })
    mockRequirePlatformAdmin.mockResolvedValue({ ok: true, userId: 'admin-1', role: 'owner', service })

    const res = await PATCH(
      patchRequest({ action: 'set_verification', verified: true, categories: ['dancer'] }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(400)
    expect(updateCalls).toHaveLength(0)
  })

  it('rejects unknown categories and empty category lists', async () => {
    const { service } = makeVerificationService({ id: USER_ID, account_type: 'talent', email: 'user@test.com' })
    mockRequirePlatformAdmin.mockResolvedValue({ ok: true, userId: 'admin-1', role: 'owner', service })

    const badCategory = await PATCH(
      patchRequest({ action: 'set_verification', verified: true, categories: ['astronaut'] }),
      { params: Promise.resolve({ id: USER_ID }) },
    )
    expect(badCategory.status).toBe(400)

    const emptyList = await PATCH(
      patchRequest({ action: 'set_verification', verified: true, categories: [] }),
      { params: Promise.resolve({ id: USER_ID }) },
    )
    expect(emptyList.status).toBe(400)
  })

  it('requires platform admin auth', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    })

    const res = await PATCH(
      patchRequest({ action: 'set_verification', verified: true, categories: ['dancer'] }),
      { params: Promise.resolve({ id: USER_ID }) },
    )
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/users/[id] set_membership_tier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeTierService(target: { id: string; account_type: string; email: string } | null) {
    const updateCalls: Array<Record<string, unknown>> = []
    const service = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: target, error: null }),
              }),
            }),
            update: (patch: Record<string, unknown>) => {
              updateCalls.push(patch)
              return {
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve({
                      data: { id: USER_ID, membership_tier: patch.membership_tier },
                      error: null,
                    }),
                  }),
                }),
              }
            },
          }
        }
        return {}
      }),
    }
    return { service, updateCalls }
  }

  function patchRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/admin/users/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('sets a talent membership tier', async () => {
    const { service, updateCalls } = makeTierService({ id: USER_ID, account_type: 'talent', email: 'user@test.com' })
    mockRequirePlatformAdmin.mockResolvedValue({ ok: true, userId: 'admin-1', role: 'owner', service })

    const res = await PATCH(
      patchRequest({ action: 'set_membership_tier', tier: 'gold' }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].membership_tier).toBe('gold')
  })

  it('rejects unknown tiers', async () => {
    const { service, updateCalls } = makeTierService({ id: USER_ID, account_type: 'talent', email: 'user@test.com' })
    mockRequirePlatformAdmin.mockResolvedValue({ ok: true, userId: 'admin-1', role: 'owner', service })

    const res = await PATCH(
      patchRequest({ action: 'set_membership_tier', tier: 'diamond' }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(400)
    expect(updateCalls).toHaveLength(0)
  })

  it('rejects tiers on hirer accounts', async () => {
    const { service, updateCalls } = makeTierService({ id: USER_ID, account_type: 'hirer', email: 'user@test.com' })
    mockRequirePlatformAdmin.mockResolvedValue({ ok: true, userId: 'admin-1', role: 'owner', service })

    const res = await PATCH(
      patchRequest({ action: 'set_membership_tier', tier: 'gold' }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(400)
    expect(updateCalls).toHaveLength(0)
  })

  it('requires platform admin auth', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({ ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) })

    const res = await PATCH(
      patchRequest({ action: 'set_membership_tier', tier: 'gold' }),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteAuthUser.mockResolvedValue({ ok: true })
    mockCountPlatformAdmins.mockResolvedValue(2)
  })

  it('deletes a non-admin account', async () => {
    const service = makeService()
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: OTHER_ADMIN_ID,
      role: 'owner',
      service,
    })

    const res = await DELETE(
      new Request('http://localhost/api/admin/users/x'),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(200)
    expect(mockDeleteAuthUser).toHaveBeenCalledWith(service, USER_ID)
  })

  it('blocks deleting platform admins', async () => {
    const service = makeService({ adminRow: { user_id: USER_ID, role: 'owner' } })
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: OTHER_ADMIN_ID,
      role: 'owner',
      service,
    })

    const res = await DELETE(
      new Request('http://localhost/api/admin/users/x'),
      { params: Promise.resolve({ id: USER_ID }) },
    )

    expect(res.status).toBe(400)
    expect(mockDeleteAuthUser).not.toHaveBeenCalled()
  })
})
