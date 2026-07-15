import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/platform-admin', () => ({
  requirePlatformAdmin: vi.fn(),
  grantPlatformAdmin: vi.fn(),
}))

import { POST } from './route'
import { requirePlatformAdmin, grantPlatformAdmin } from '@/lib/platform-admin'

const mockRequirePlatformAdmin = requirePlatformAdmin as ReturnType<typeof vi.fn>
const mockGrantPlatformAdmin = grantPlatformAdmin as ReturnType<typeof vi.fn>

const NEW_USER_ID = '66666666-6666-4666-8666-666666666666'

function makeService({
  existingProfile = null as { id: string } | null,
  createError = null as { code: string } | null,
} = {}) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: existingProfile, error: null }),
        }),
      }),
    })),
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: createError ? { user: null } : { user: { id: NEW_USER_ID } },
          error: createError,
        }),
      },
    },
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGrantPlatformAdmin.mockResolvedValue(true)
  })

  it('creates a hirer account', async () => {
    const service = makeService()
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service,
    })

    const res = await POST(makeRequest({
      full_name: 'New Hirer',
      email: 'New.Hirer@Test.com',
      role: 'hirer',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.id).toBe(NEW_USER_ID)
    expect(body.user.email).toBe('new.hirer@test.com')
    expect(body.user.display_role).toBe('hirer')
    expect(service.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'new.hirer@test.com',
      email_confirm: true,
      user_metadata: { full_name: 'New Hirer', account_type: 'hirer' },
    })
    expect(mockGrantPlatformAdmin).not.toHaveBeenCalled()
  })

  it('creates an admin account and grants platform admin', async () => {
    const service = makeService()
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service,
    })

    const res = await POST(makeRequest({
      full_name: 'New Admin',
      email: 'admin@test.com',
      role: 'admin',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.display_role).toBe('admin')
    expect(body.user.platform_admin_role).toBe('owner')
    expect(mockGrantPlatformAdmin).toHaveBeenCalledWith(service, NEW_USER_ID, 'owner')
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const res = await POST(makeRequest({
      full_name: 'Someone',
      email: 'someone@test.com',
      role: 'hirer',
    }))

    expect(res.status).toBe(401)
  })

  it('returns 403 when a non-owner admin tries to create an admin account', async () => {
    const service = makeService()
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-2',
      role: 'moderator',
      service,
    })

    const res = await POST(makeRequest({
      full_name: 'New Admin',
      email: 'admin@test.com',
      role: 'admin',
    }))

    expect(res.status).toBe(403)
    expect(service.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('rejects a duplicate email', async () => {
    const service = makeService({ existingProfile: { id: 'existing-1' } })
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service,
    })

    const res = await POST(makeRequest({
      full_name: 'Dup User',
      email: 'dup@test.com',
      role: 'talent',
    }))

    expect(res.status).toBe(400)
    expect(service.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('rejects an invalid role', async () => {
    const service = makeService()
    mockRequirePlatformAdmin.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      role: 'owner',
      service,
    })

    const res = await POST(makeRequest({
      full_name: 'Someone',
      email: 'someone@test.com',
      role: 'superuser',
    }))

    expect(res.status).toBe(400)
    expect(service.auth.admin.createUser).not.toHaveBeenCalled()
  })
})
