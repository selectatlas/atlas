import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }))

import { GET } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>
const mockRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

function caller(user: { id: string } | null, accountType: string | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: accountType ? { account_type: accountType } : null }) }) }) })),
  }
}

function service() {
  return {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => ({ select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) })),
  }
}

describe('GET /api/talent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue(null)
    mockCreateServiceClient.mockReturnValue(service())
  })

  it('requires authentication and a hirer account', async () => {
    mockCreateClient.mockResolvedValue(caller(null, null))
    expect((await GET(new Request('http://localhost/api/talent'))).status).toBe(401)
    mockCreateClient.mockResolvedValue(caller({ id: 'u1' }, 'talent'))
    expect((await GET(new Request('http://localhost/api/talent'))).status).toBe(403)
  })

  it('rejects malformed or unknown URL filters', async () => {
    mockCreateClient.mockResolvedValue(caller({ id: 'u1' }, 'hirer'))
    expect((await GET(new Request('http://localhost/api/talent?height_min=20'))).status).toBe(400)
    expect((await GET(new Request('http://localhost/api/talent?admin=true'))).status).toBe(400)
  })

  it('passes validated public and restricted filters to the server-side RPC', async () => {
    mockCreateClient.mockResolvedValue(caller({ id: 'u1' }, 'hirer'))
    const mockService = service()
    mockCreateServiceClient.mockReturnValue(mockService)
    const response = await GET(new Request('http://localhost/api/talent?category=actor&hair_type=3b_curly&nudity=false'))
    expect(response.status).toBe(200)
    expect(mockService.rpc).toHaveBeenCalledWith('search_talent_filtered', expect.objectContaining({
      filters: { category: 'actor', attributes: { hair_type: ['3b_curly'] }, sensitive: { nudity: false } },
    }))
  })
})
