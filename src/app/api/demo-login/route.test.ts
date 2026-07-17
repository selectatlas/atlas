import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { DEMO_HIRER, DEMO_PASSWORD } from '@/lib/seed/demo-world'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function supabaseWithSignIn(error: { message: string } | null) {
  const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error })
  mockCreateClient.mockResolvedValue({ auth: { signInWithPassword } })
  return signInWithPassword
}

describe('GET /api/demo-login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirects to login outside development without attempting sign-in', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const signIn = supabaseWithSignIn(null)

    const response = await GET(new Request('http://localhost:3000/api/demo-login?role=hirer'))

    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    expect(signIn).not.toHaveBeenCalled()
  })

  it('signs in as the seeded hirer and clears cookie-demo state', async () => {
    const signIn = supabaseWithSignIn(null)

    const response = await GET(new Request('http://localhost:3000/api/demo-login?role=hirer'))

    expect(signIn).toHaveBeenCalledWith({ email: DEMO_HIRER.email, password: DEMO_PASSWORD })
    expect(response.headers.get('location')).toBe('http://localhost:3000/home')
    const setCookies = response.headers.getSetCookie().join('; ')
    expect(setCookies).toContain('atlas_demo=;')
    expect(setCookies).not.toContain('atlas_demo=1')
  })

  it('signs in as the seeded talent by default', async () => {
    const signIn = supabaseWithSignIn(null)

    await GET(new Request('http://localhost:3000/api/demo-login'))

    expect(signIn).toHaveBeenCalledWith({
      email: 'priya.singh@atlas-demo.com',
      password: DEMO_PASSWORD,
    })
  })

  it('falls back to cookie-only demo mode when the demo accounts are not seeded', async () => {
    supabaseWithSignIn({ message: 'Invalid login credentials' })

    const response = await GET(new Request('http://localhost:3000/api/demo-login?role=talent'))

    expect(response.headers.get('location')).toBe('http://localhost:3000/home')
    const setCookies = response.headers.getSetCookie().join('; ')
    expect(setCookies).toContain('atlas_demo=1')
    expect(setCookies).toContain('atlas_demo_role=talent')
  })
})
