import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}))
vi.mock('@/lib/posthog-server', () => ({ getPostHogClient: vi.fn(() => ({ capture: vi.fn() })) }))
vi.mock('@/lib/log', () => ({ logEvent: vi.fn() }))

import { GET } from './route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as ReturnType<typeof vi.fn>
const mockRateLimit = enforceRateLimit as ReturnType<typeof vi.fn>

function authClient(user: { id: string; user_metadata: Record<string, unknown> } | null, exchangeError = false) {
  const result = exchangeError
    ? { data: { user: null }, error: { message: 'invalid code' } }
    : { data: { user }, error: null }
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue(result),
      verifyOtp: vi.fn().mockResolvedValue(result),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  }
}

function service() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  return { from: vi.fn(() => ({ update })), update, eq }
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue(null)
  })

  it('redirects to login on a missing code without touching Supabase', async () => {
    const response = await GET(new Request('http://localhost/auth/callback'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login?error=oauth')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('redirects to login when the code exchange fails', async () => {
    mockCreateClient.mockResolvedValue(authClient(null, true))
    const response = await GET(new Request('http://localhost/auth/callback?code=bad'))
    expect(response.headers.get('location')).toBe('http://localhost/login?error=oauth')
  })

  it('sends returning users to their workspace without rewriting metadata', async () => {
    const client = authClient({ id: 'u1', user_metadata: { account_type: 'hirer' } })
    mockCreateClient.mockResolvedValue(client)
    const response = await GET(new Request('http://localhost/auth/callback?code=ok'))
    expect(response.headers.get('location')).toBe('http://localhost/home')
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('defaults first-time OAuth users to talent and sends them to discover', async () => {
    const client = authClient({ id: 'u1', user_metadata: {} })
    mockCreateClient.mockResolvedValue(client)
    const response = await GET(new Request('http://localhost/auth/callback?code=ok'))
    expect(response.headers.get('location')).toBe('http://localhost/home')
    expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { account_type: 'talent' } })
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('applies the hirer choice from signup via metadata and a service-role profile fix', async () => {
    const client = authClient({ id: 'u1', user_metadata: {} })
    mockCreateClient.mockResolvedValue(client)
    const mockService = service()
    mockCreateServiceClient.mockReturnValue(mockService)

    const response = await GET(new Request('http://localhost/auth/callback?code=ok&account_type=hirer'))

    expect(response.headers.get('location')).toBe('http://localhost/home')
    expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { account_type: 'hirer' } })
    expect(mockService.update).toHaveBeenCalledWith({ account_type: 'hirer' })
    expect(mockService.eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('treats an unknown requested account_type as talent', async () => {
    const client = authClient({ id: 'u1', user_metadata: {} })
    mockCreateClient.mockResolvedValue(client)
    const response = await GET(new Request('http://localhost/auth/callback?code=ok&account_type=admin'))
    expect(response.headers.get('location')).toBe('http://localhost/home')
    expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { account_type: 'talent' } })
  })

  it('verifies email confirmation links via token_hash and lands on home', async () => {
    const client = authClient({ id: 'u1', user_metadata: { account_type: 'talent' } })
    mockCreateClient.mockResolvedValue(client)
    const response = await GET(new Request('http://localhost/auth/callback?token_hash=abc&type=signup'))
    expect(response.headers.get('location')).toBe('http://localhost/home')
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ type: 'signup', token_hash: 'abc' })
    expect(client.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects expired email links to login with a confirm error', async () => {
    mockCreateClient.mockResolvedValue(authClient(null, true))
    const response = await GET(new Request('http://localhost/auth/callback?token_hash=stale&type=signup'))
    expect(response.headers.get('location')).toBe('http://localhost/login?error=confirm')
  })

  it('returns 429 when the IP is rate limited', async () => {
    mockRateLimit.mockResolvedValue(new Response(null, { status: 429 }))
    const response = await GET(new Request('http://localhost/auth/callback?code=ok'))
    expect(response.status).toBe(429)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })
})
